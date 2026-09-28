// Custom Views — menu analytics backed by the signed-in user's real data.
//
//   GET  /api/custom-views/menu-tree        -> hierarchy built from this user's menus
//   GET  /api/custom-views/dish-popularity  -> requires an order/POS data source (503 without one)
//   GET  /api/custom-views/menus            -> this user's menus (picker for PDF export)
//   POST /api/custom-views/menu-pdf         -> downloadable PDF of one real menu
//   POST /api/custom-views/menu-ocr         -> provider-backed image extraction (503 without a provider)
//
// Nothing here synthesizes dishes, prices, confidence scores or order counts.
const { Router } = require('express');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const pool = require('../db/connection').default;
const { authenticateToken } = require('../middleware/auth');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.use(authenticateToken);

// ---------------------------------------------------------------------------
// OPENROUTER helpers — real provider calls only. When no key is configured the
// route fails with 503 and says so; it never falls back to generated data.
// ---------------------------------------------------------------------------

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

function providerConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function noProviderResponse(res) {
  return res.status(503).json({
    error: 'No OCR/AI provider configured. Set OPENROUTER_API_KEY to enable menu image extraction.',
    code: 'NO_PROVIDER_CONFIGURED',
  });
}

function parseJsonResponse(content) {
  const stripped = String(content || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function extractMenuFromImage(base64Data, mimeType) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Menu Digitizer',
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0.2,
      max_tokens: 10000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64Data },
            },
            {
              type: 'text',
              text: 'Extract all menu items from this image. Return JSON: { "restaurant_name": string|null, "items": [{ "name": string, "description": string, "price": number|null, "category": string, "is_vegetarian": boolean, "is_vegan": boolean, "is_gluten_free": boolean }] }',
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.error) {
    const message = data?.error?.message || `OpenRouter request failed (${response.status})`;
    throw new Error(message);
  }
  return { content: data.choices?.[0]?.message?.content || '', model: data.model || VISION_MODEL };
}

// ---------------------------------------------------------------------------
// GET /api/custom-views/menu-tree
// Hierarchical menu structure computed from the user's menus and menu items.
// ---------------------------------------------------------------------------

router.get('/menu-tree', async (req, res) => {
  try {
    const menusResult = await pool.query(
      'SELECT id, name, restaurant_name FROM menus WHERE user_id = $1 ORDER BY name',
      [req.userId]
    );
    const itemsResult = await pool.query(
      `SELECT mi.id, mi.menu_id, mi.name, mi.price, mi.category
       FROM menu_items mi
       JOIN menus m ON mi.menu_id = m.id
       WHERE m.user_id = $1
       ORDER BY mi.category, mi.name`,
      [req.userId]
    );

    const categoriesByMenu = new Map();
    for (const item of itemsResult.rows) {
      if (!categoriesByMenu.has(item.menu_id)) categoriesByMenu.set(item.menu_id, new Map());
      const categories = categoriesByMenu.get(item.menu_id);
      const categoryName = item.category || 'Uncategorized';
      if (!categories.has(categoryName)) categories.set(categoryName, []);
      categories.get(categoryName).push({
        id: item.id,
        name: item.name,
        price: item.price != null ? Number(item.price) : null,
      });
    }

    const sections = menusResult.rows.map((menu) => {
      const categories = categoriesByMenu.get(menu.id) || new Map();
      return {
        id: menu.id,
        name: menu.name,
        subtitle: menu.restaurant_name || null,
        categories: [...categories.entries()].map(([name, dishes]) => ({
          id: `${menu.id}:${name}`,
          name,
          dishes,
        })),
      };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      totalSections: sections.length,
      totalDishes: sections.reduce((n, s) => n + s.categories.reduce((m, c) => m + c.dishes.length, 0), 0),
      sections,
    });
  } catch (error) {
    console.error('menu-tree error:', error);
    res.status(500).json({ error: 'Failed to build menu tree' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/custom-views/dish-popularity
// Order counts require an order/POS data source; none is connected to this
// application, so the endpoint states that instead of inventing numbers.
// ---------------------------------------------------------------------------

router.get('/dish-popularity', (req, res) => {
  res.status(503).json({
    error: 'Dish popularity requires order data from a connected POS/order source. No order data source is configured.',
    code: 'NO_ORDER_DATA_SOURCE',
    required: 'Connect a POS/order data integration to compute order counts.',
  });
});

// ---------------------------------------------------------------------------
// GET /api/custom-views/menus — real menus for the PDF export picker.
// ---------------------------------------------------------------------------

router.get('/menus', async (req, res) => {
  try {
    const menusResult = await pool.query(
      `SELECT m.id, m.name, m.restaurant_name, m.description, COUNT(mi.id)::int AS item_count
       FROM menus m
       LEFT JOIN menu_items mi ON mi.menu_id = m.id
       WHERE m.user_id = $1
       GROUP BY m.id
       ORDER BY m.name`,
      [req.userId]
    );
    const itemsResult = await pool.query(
      `SELECT mi.id, mi.menu_id, mi.name, mi.description, mi.price, mi.category
       FROM menu_items mi
       JOIN menus m ON mi.menu_id = m.id
       WHERE m.user_id = $1
       ORDER BY mi.category, mi.name`,
      [req.userId]
    );

    const itemsByMenu = new Map();
    for (const item of itemsResult.rows) {
      if (!itemsByMenu.has(item.menu_id)) itemsByMenu.set(item.menu_id, []);
      itemsByMenu.get(item.menu_id).push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price != null ? Number(item.price) : null,
        category: item.category || 'Uncategorized',
      });
    }

    res.json({
      menus: menusResult.rows.map((menu) => ({
        id: menu.id,
        name: menu.name,
        restaurant_name: menu.restaurant_name,
        item_count: menu.item_count,
        items: itemsByMenu.get(menu.id) || [],
      })),
    });
  } catch (error) {
    console.error('custom-views menus error:', error);
    res.status(500).json({ error: 'Failed to load menus' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/custom-views/menu-pdf — styled PDF of one real menu.
// Body: { menuId, style: 'Classic'|'Modern'|'Minimalist', paper: 'A4'|'Letter' }
// ---------------------------------------------------------------------------

const STYLES = {
  Classic: {
    title:    { font: 'Times-Bold',   size: 28, color: '#7c2d12' },
    subtitle: { font: 'Times-Italic', size: 12, color: '#92400e' },
    section:  { font: 'Times-Bold',   size: 18, color: '#7c2d12' },
    category: { font: 'Times-Bold',   size: 13, color: '#1f2937' },
    dish:     { font: 'Times-Bold',   size: 11, color: '#111827' },
    desc:     { font: 'Times-Italic', size: 10, color: '#4b5563' },
    price:    { font: 'Times-Bold',   size: 11, color: '#7c2d12' },
    divider:  '#d6d3d1',
    accent:   '#7c2d12',
  },
  Modern: {
    title:    { font: 'Helvetica-Bold', size: 30, color: '#0f172a' },
    subtitle: { font: 'Helvetica',      size: 11, color: '#64748b' },
    section:  { font: 'Helvetica-Bold', size: 16, color: '#0ea5e9' },
    category: { font: 'Helvetica-Bold', size: 12, color: '#0f172a' },
    dish:     { font: 'Helvetica-Bold', size: 11, color: '#0f172a' },
    desc:     { font: 'Helvetica',      size: 10, color: '#475569' },
    price:    { font: 'Helvetica-Bold', size: 11, color: '#0ea5e9' },
    divider:  '#e2e8f0',
    accent:   '#0ea5e9',
  },
  Minimalist: {
    title:    { font: 'Helvetica',      size: 24, color: '#111827' },
    subtitle: { font: 'Helvetica',      size: 10, color: '#9ca3af' },
    section:  { font: 'Helvetica',      size: 14, color: '#111827' },
    category: { font: 'Helvetica-Bold', size: 11, color: '#374151' },
    dish:     { font: 'Helvetica',      size: 10, color: '#111827' },
    desc:     { font: 'Helvetica',      size:  9, color: '#6b7280' },
    price:    { font: 'Helvetica',      size: 10, color: '#111827' },
    divider:  '#e5e7eb',
    accent:   '#111827',
  },
};

const PAPER_SIZES = { A4: 'A4', Letter: 'LETTER' };

router.post('/menu-pdf', async (req, res) => {
  try {
    const body = req.body || {};
    const menuId = Number.parseInt(body.menuId, 10);
    if (!Number.isSafeInteger(menuId) || menuId <= 0) {
      return res.status(400).json({ error: 'menuId is required' });
    }

    const menuResult = await pool.query(
      'SELECT id, name, restaurant_name, description FROM menus WHERE id = $1 AND user_id = $2',
      [menuId, req.userId]
    );
    if (!menuResult.rows[0]) {
      return res.status(404).json({ error: 'Menu not found' });
    }
    const menu = menuResult.rows[0];

    const itemsResult = await pool.query(
      'SELECT name, description, price, category FROM menu_items WHERE menu_id = $1 ORDER BY category, name',
      [menuId]
    );
    if (itemsResult.rows.length === 0) {
      return res.status(422).json({ error: 'Menu has no items to export' });
    }

    const styleKey = STYLES[body.style] ? body.style : 'Classic';
    const paperKey = PAPER_SIZES[body.paper] ? body.paper : 'A4';
    const style = STYLES[styleKey];

    const doc = new PDFDocument({ size: PAPER_SIZES[paperKey], margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    const filename = `menu-${menu.id}-${styleKey.toLowerCase()}-${paperKey.toLowerCase()}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const title = menu.restaurant_name || menu.name;
    doc.fillColor(style.title.color).font(style.title.font).fontSize(style.title.size)
       .text(title, { align: 'center' });
    doc.moveDown(0.2);
    doc.fillColor(style.subtitle.color).font(style.subtitle.font).fontSize(style.subtitle.size)
       .text(`${menu.name} · ${styleKey} Style · ${paperKey}`, { align: 'center' });
    doc.moveDown(0.6);

    const headerY = doc.y;
    doc.moveTo(50, headerY).lineTo(doc.page.width - 50, headerY)
       .lineWidth(1.2).strokeColor(style.accent).stroke();
    doc.moveDown(0.8);

    const categories = new Map();
    for (const item of itemsResult.rows) {
      const name = item.category || 'Uncategorized';
      if (!categories.has(name)) categories.set(name, []);
      categories.get(name).push(item);
    }

    for (const [categoryName, dishes] of categories) {
      if (doc.y > doc.page.height - 100) doc.addPage();

      doc.fillColor(style.category.color).font(style.category.font).fontSize(style.category.size)
         .text(categoryName);
      doc.moveDown(0.15);

      for (const dish of dishes) {
        if (doc.y > doc.page.height - 70) doc.addPage();

        const startY = doc.y;
        const pageWidth = doc.page.width - 100;
        const priceText = dish.price != null ? `$${Number(dish.price).toFixed(2)}` : '';
        const priceWidth = priceText
          ? doc.font(style.price.font).fontSize(style.price.size).widthOfString(priceText)
          : 0;

        doc.fillColor(style.dish.color).font(style.dish.font).fontSize(style.dish.size)
           .text(dish.name, 50, startY, { width: pageWidth - priceWidth - 12, continued: false });

        if (priceText) {
          doc.fillColor(style.price.color).font(style.price.font).fontSize(style.price.size)
             .text(priceText, doc.page.width - 50 - priceWidth, startY);
        }

        if (dish.description) {
          doc.fillColor(style.desc.color).font(style.desc.font).fontSize(style.desc.size)
             .text(dish.description, 50, doc.y + 2, { width: pageWidth });
        }
        doc.moveDown(0.4);

        const sy = doc.y;
        doc.moveTo(50, sy).lineTo(doc.page.width - 50, sy)
           .lineWidth(0.4).strokeColor(style.divider).stroke();
        doc.moveDown(0.3);
      }

      doc.moveDown(0.2);
    }

    doc.fillColor(style.subtitle.color).font(style.subtitle.font).fontSize(9)
       .text(`Generated ${new Date().toISOString().slice(0, 10)} — AI Menu Digitizer`,
             50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });

    doc.end();
  } catch (error) {
    console.error('menu-pdf error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate menu PDF' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/custom-views/menu-ocr (multipart field "image")
// Real provider-backed extraction. No provider -> 503; unparseable provider
// output -> 502. Dishes/prices are never synthesized locally.
// ---------------------------------------------------------------------------

router.post('/menu-ocr', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded (expected multipart field "image").' });
    }
    if (!providerConfigured()) {
      return noProviderResponse(res);
    }

    const mimeType = req.file.mimetype || 'image/jpeg';
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(mimeType)) {
      return res.status(415).json({ error: `Unsupported image type: ${mimeType}. Use PNG, JPEG, WebP or GIF.` });
    }

    const result = await extractMenuFromImage(req.file.buffer.toString('base64'), mimeType);
    const parsed = parseJsonResponse(result.content);
    if (!parsed || !Array.isArray(parsed.items)) {
      return res.status(502).json({
        error: 'The AI provider did not return a parseable menu extraction. Try a clearer image or retry.',
        code: 'UNPARSEABLE_PROVIDER_RESPONSE',
      });
    }

    const items = parsed.items
      .filter((item) => item && typeof item.name === 'string' && item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        description: typeof item.description === 'string' ? item.description : '',
        price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
        category: typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'Uncategorized',
        is_vegetarian: Boolean(item.is_vegetarian ?? item.dietary_flags?.vegetarian),
        is_vegan: Boolean(item.is_vegan ?? item.dietary_flags?.vegan),
        is_gluten_free: Boolean(item.is_gluten_free ?? item.dietary_flags?.gluten_free),
      }));

    if (items.length === 0) {
      return res.status(422).json({
        error: 'No menu items were found in this image. Upload a clearer photo of the menu.',
        code: 'NO_ITEMS_EXTRACTED',
      });
    }

    const sectionsByName = new Map();
    for (const item of items) {
      if (!sectionsByName.has(item.category)) sectionsByName.set(item.category, []);
      sectionsByName.get(item.category).push(item);
    }

    res.json({
      file: { name: req.file.originalname, size: req.file.size, mimetype: mimeType },
      restaurant_name: typeof parsed.restaurant_name === 'string' ? parsed.restaurant_name : null,
      items,
      parsed_sections: [...sectionsByName.entries()].map(([name, dishes]) => ({ name, dishes })),
      confidence: null,
      provider: 'openrouter',
      model: result.model,
      generatedAt: new Date().toISOString(),
      note: `Extracted by ${result.model}. Review dishes and prices before importing or publishing.`,
    });
  } catch (error) {
    console.error('menu-ocr error:', error);
    if (!res.headersSent) res.status(502).json({ error: `Menu image extraction failed: ${error.message}` });
  }
});

module.exports = router;
module.exports.default = router;
