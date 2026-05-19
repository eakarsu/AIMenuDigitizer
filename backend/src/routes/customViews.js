// Custom Views — bespoke menu analytics endpoints.
// Provides synthesized data for:
//   GET  /api/custom-views/menu-tree        -> hierarchical menu structure
//   GET  /api/custom-views/dish-popularity  -> top N dishes by simulated order count
//   GET  /api/custom-views/restaurants      -> picker list for PDF export
//   POST /api/custom-views/menu-pdf         -> downloadable styled PDF menu
//   POST /api/custom-views/menu-ocr         -> mock OCR parse of uploaded menu image
// Data is synthesized deterministically so the UI is meaningful even when no
// real menus exist yet.
const { Router } = require('express');
const PDFDocument = require('pdfkit');
const multer = require('multer');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Deterministic pseudo-random helper so popularity rankings are stable.
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const MENU_TREE = [
  {
    id: 'breakfast',
    name: 'Breakfast Menu',
    categories: [
      {
        id: 'eggs', name: 'Eggs & Omelets', dishes: [
          { id: 'd1', name: 'Classic Eggs Benedict', price: 14.50 },
          { id: 'd2', name: 'Smoked Salmon Omelet', price: 16.75 },
          { id: 'd3', name: 'Veggie Frittata', price: 12.25 },
        ],
      },
      {
        id: 'pancakes', name: 'Pancakes & Waffles', dishes: [
          { id: 'd4', name: 'Buttermilk Pancakes', price: 11.00 },
          { id: 'd5', name: 'Belgian Waffle', price: 12.50 },
          { id: 'd6', name: 'Blueberry Stack', price: 13.25 },
        ],
      },
    ],
  },
  {
    id: 'lunch',
    name: 'Lunch Menu',
    categories: [
      {
        id: 'sandwiches', name: 'Sandwiches', dishes: [
          { id: 'd7', name: 'Grilled Chicken Club', price: 15.50 },
          { id: 'd8', name: 'Caprese Panini', price: 13.00 },
          { id: 'd9', name: 'Reuben on Rye', price: 16.25 },
        ],
      },
      {
        id: 'salads', name: 'Salads', dishes: [
          { id: 'd10', name: 'Caesar Salad', price: 11.75 },
          { id: 'd11', name: 'Cobb Salad', price: 14.50 },
          { id: 'd12', name: 'Quinoa Power Bowl', price: 13.50 },
        ],
      },
    ],
  },
  {
    id: 'dinner',
    name: 'Dinner Menu',
    categories: [
      {
        id: 'pasta', name: 'Pasta', dishes: [
          { id: 'd13', name: 'Truffle Mushroom Risotto', price: 24.00 },
          { id: 'd14', name: 'Linguine alle Vongole', price: 26.50 },
          { id: 'd15', name: 'Lobster Ravioli', price: 32.00 },
        ],
      },
      {
        id: 'mains', name: 'Mains', dishes: [
          { id: 'd16', name: 'Ribeye Steak 14oz', price: 42.00 },
          { id: 'd17', name: 'Pan-Seared Sea Bass', price: 36.50 },
          { id: 'd18', name: 'Duck Confit', price: 34.75 },
          { id: 'd19', name: 'Roasted Lamb Shank', price: 38.00 },
        ],
      },
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    categories: [
      {
        id: 'cakes', name: 'Cakes & Tarts', dishes: [
          { id: 'd20', name: 'Tiramisu', price: 9.50 },
          { id: 'd21', name: 'Chocolate Lava Cake', price: 10.25 },
          { id: 'd22', name: 'Lemon Tart', price: 8.75 },
        ],
      },
    ],
  },
];

function popularityFor(name) {
  // Stable simulated order count: 40..540
  return 40 + (hash(name) % 500);
}

function popularityBadge(orderCount) {
  if (orderCount >= 400) return 'hot';
  if (orderCount >= 250) return 'popular';
  if (orderCount >= 150) return 'steady';
  return 'slow';
}

// GET /api/custom-views/menu-tree
router.get('/menu-tree', (req, res) => {
  const sections = MENU_TREE.map((section) => ({
    id: section.id,
    name: section.name,
    categories: section.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      dishes: cat.dishes.map((d) => {
        const orderCount = popularityFor(d.name);
        return {
          id: d.id,
          name: d.name,
          price: d.price,
          orderCount,
          badge: popularityBadge(orderCount),
        };
      }),
    })),
  }));
  res.json({
    generatedAt: new Date().toISOString(),
    totalSections: sections.length,
    totalDishes: sections.reduce((n, s) => n + s.categories.reduce((m, c) => m + c.dishes.length, 0), 0),
    sections,
  });
});

// GET /api/custom-views/dish-popularity?limit=15
router.get('/dish-popularity', (req, res) => {
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 15));
  const all = [];
  MENU_TREE.forEach((s) => s.categories.forEach((c) => c.dishes.forEach((d) => {
    all.push({
      id: d.id,
      name: d.name,
      section: s.name,
      category: c.name,
      price: d.price,
      orderCount: popularityFor(d.name),
    });
  })));
  all.sort((a, b) => b.orderCount - a.orderCount);
  const top = all.slice(0, limit);
  res.json({
    generatedAt: new Date().toISOString(),
    limit,
    totalConsidered: all.length,
    dishes: top,
  });
});

// ====================================================================
// Custom Feature #3 — MENU PDF EXPORT
// ====================================================================

const RESTAURANTS = [
  { id: 'rest-bistro',   name: 'The Bistro Downtown',     cuisine: 'European' },
  { id: 'rest-harbor',   name: 'Harbor Seafood House',     cuisine: 'Seafood'  },
  { id: 'rest-trattoria',name: 'Trattoria Bella',          cuisine: 'Italian'  },
  { id: 'rest-garden',   name: 'The Garden Cafe',          cuisine: 'American' },
];

const DISH_DESCRIPTIONS = {
  'Classic Eggs Benedict': 'Two poached eggs on toasted English muffin, Canadian bacon, hollandaise.',
  'Smoked Salmon Omelet': 'Three-egg omelet with cold-smoked salmon, dill cream cheese, chives.',
  'Veggie Frittata': 'Open-faced frittata with seasonal vegetables and aged gruyere.',
  'Buttermilk Pancakes': 'Stack of three fluffy pancakes with warm maple syrup and butter.',
  'Belgian Waffle': 'Crisp Liege-style waffle with powdered sugar and fresh berries.',
  'Blueberry Stack': 'Wild blueberry pancakes with vanilla cream and lemon zest.',
  'Grilled Chicken Club': 'Triple-stacked club with grilled chicken, bacon, lettuce, tomato, avocado.',
  'Caprese Panini': 'Fresh mozzarella, tomato, basil, and balsamic glaze on toasted ciabatta.',
  'Reuben on Rye': 'House-cured corned beef, sauerkraut, Swiss, Russian dressing on rye.',
  'Caesar Salad': 'Crisp romaine, parmigiano-reggiano, focaccia croutons, anchovy dressing.',
  'Cobb Salad': 'Chicken, bacon, blue cheese, avocado, egg, tomato on mixed greens.',
  'Quinoa Power Bowl': 'Tri-color quinoa, roasted chickpeas, kale, tahini-lemon dressing.',
  'Truffle Mushroom Risotto': 'Carnaroli rice, wild mushrooms, black truffle, parmigiano.',
  'Linguine alle Vongole': 'Fresh linguine with Manila clams, white wine, garlic, chili flake.',
  'Lobster Ravioli': 'Hand-cut ravioli filled with Maine lobster in saffron cream sauce.',
  'Ribeye Steak 14oz': 'Dry-aged USDA prime ribeye with bone marrow butter and roasted shallots.',
  'Pan-Seared Sea Bass': 'Crispy-skin sea bass with fennel puree and citrus beurre blanc.',
  'Duck Confit': 'Slow-cooked duck leg with lentils du Puy and cherry gastrique.',
  'Roasted Lamb Shank': 'Braised lamb shank with rosemary jus, polenta, gremolata.',
  'Tiramisu': 'Classic mascarpone tiramisu with espresso-soaked ladyfingers.',
  'Chocolate Lava Cake': 'Warm flourless chocolate cake with molten center, vanilla bean ice cream.',
  'Lemon Tart': 'Buttery sable crust filled with Meyer lemon curd, torched meringue.',
};

function describe(name) {
  return DISH_DESCRIPTIONS[name] || 'Chef-crafted house specialty made with seasonal ingredients.';
}

// GET /api/custom-views/restaurants — list for the picker
router.get('/restaurants', (req, res) => {
  res.json({ restaurants: RESTAURANTS });
});

// Style themes for PDF rendering
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

// POST /api/custom-views/menu-pdf
// Body: { restaurantId, style: 'Classic'|'Modern'|'Minimalist', paper: 'A4'|'Letter' }
router.post('/menu-pdf', (req, res) => {
  const body = req.body || {};
  const restaurantId = body.restaurantId || RESTAURANTS[0].id;
  const styleKey = STYLES[body.style] ? body.style : 'Classic';
  const paperKey = PAPER_SIZES[body.paper] ? body.paper : 'A4';
  const style = STYLES[styleKey];
  const restaurant = RESTAURANTS.find((r) => r.id === restaurantId) || RESTAURANTS[0];

  const doc = new PDFDocument({ size: PAPER_SIZES[paperKey], margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  const filename = `menu-${restaurant.id}-${styleKey.toLowerCase()}-${paperKey.toLowerCase()}.pdf`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // Header
  doc.fillColor(style.title.color).font(style.title.font).fontSize(style.title.size)
     .text(restaurant.name, { align: 'center' });
  doc.moveDown(0.2);
  doc.fillColor(style.subtitle.color).font(style.subtitle.font).fontSize(style.subtitle.size)
     .text(`${restaurant.cuisine} Cuisine · ${styleKey} Style · ${paperKey}`, { align: 'center' });
  doc.moveDown(0.6);

  // Accent divider line
  const headerY = doc.y;
  doc.moveTo(50, headerY).lineTo(doc.page.width - 50, headerY)
     .lineWidth(1.2).strokeColor(style.accent).stroke();
  doc.moveDown(0.8);

  // Sections / categories / dishes
  MENU_TREE.forEach((section) => {
    if (doc.y > doc.page.height - 120) doc.addPage();

    doc.fillColor(style.section.color).font(style.section.font).fontSize(style.section.size)
       .text(section.name.toUpperCase());
    doc.moveDown(0.3);

    section.categories.forEach((cat) => {
      if (doc.y > doc.page.height - 100) doc.addPage();

      doc.fillColor(style.category.color).font(style.category.font).fontSize(style.category.size)
         .text(cat.name);
      doc.moveDown(0.15);

      cat.dishes.forEach((d) => {
        if (doc.y > doc.page.height - 70) doc.addPage();

        const startY = doc.y;
        const pageWidth = doc.page.width - 100; // margins
        const priceText = `$${Number(d.price).toFixed(2)}`;
        const priceWidth = doc.font(style.price.font).fontSize(style.price.size).widthOfString(priceText);

        // Dish name on left
        doc.fillColor(style.dish.color).font(style.dish.font).fontSize(style.dish.size)
           .text(d.name, 50, startY, { width: pageWidth - priceWidth - 12, continued: false });

        // Price on right
        doc.fillColor(style.price.color).font(style.price.font).fontSize(style.price.size)
           .text(priceText, doc.page.width - 50 - priceWidth, startY);

        // Description
        doc.fillColor(style.desc.color).font(style.desc.font).fontSize(style.desc.size)
           .text(describe(d.name), 50, doc.y + 2, { width: pageWidth });
        doc.moveDown(0.4);

        // Light separator
        const sy = doc.y;
        doc.moveTo(50, sy).lineTo(doc.page.width - 50, sy)
           .lineWidth(0.4).strokeColor(style.divider).stroke();
        doc.moveDown(0.3);
      });

      doc.moveDown(0.2);
    });

    doc.moveDown(0.4);
  });

  // Footer
  doc.fillColor(style.subtitle.color).font(style.subtitle.font).fontSize(9)
     .text(`Generated ${new Date().toISOString().slice(0, 10)} — AI Menu Digitizer`,
           50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });

  doc.end();
});

// ====================================================================
// Custom Feature #4 — OCR MENU IMAGE UPLOAD (mock)
// ====================================================================

// POST /api/custom-views/menu-ocr  (multipart: field "image")
// Returns deterministic-mock parsed menu structure derived from file size/name.
router.post('/menu-ocr', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded (expected multipart field "image").' });
  }

  const file = req.file;
  const seed = hash((file.originalname || 'menu') + ':' + file.size);

  // Deterministic mock: 2 sections, 2-3 dishes each, derived from seed.
  const SECTION_POOL = [
    { name: 'Starters', dishes: [
      { name: 'Burrata with Heirloom Tomatoes', price: 14.50, description: 'Creamy burrata, balsamic reduction, basil oil.' },
      { name: 'Crispy Calamari', price: 13.25, description: 'Lightly fried calamari with lemon-aioli.' },
      { name: 'Garlic Shrimp Tapas', price: 15.00, description: 'Sauteed shrimp in garlic-butter sauce.' },
    ]},
    { name: 'Main Courses', dishes: [
      { name: 'Pan-Seared Salmon', price: 26.75, description: 'Atlantic salmon with lemon-dill beurre blanc.' },
      { name: 'Filet Mignon 8oz', price: 38.50, description: '8oz center-cut filet, red wine demi-glace.' },
      { name: 'Wild Mushroom Pappardelle', price: 22.00, description: 'House-made pasta, wild mushrooms, truffle oil.' },
    ]},
    { name: 'Desserts', dishes: [
      { name: 'Creme Brulee', price: 9.75, description: 'Classic vanilla bean creme brulee.' },
      { name: 'Flourless Chocolate Torte', price: 10.50, description: 'Dark chocolate torte, raspberry coulis.' },
    ]},
    { name: 'Beverages', dishes: [
      { name: 'House Red Wine', price: 12.00, description: 'Glass of house Cabernet Sauvignon.' },
      { name: 'Espresso Martini', price: 14.50, description: 'Vodka, espresso, coffee liqueur.' },
    ]},
  ];

  // Pick 2 sections deterministically.
  const idxA = seed % SECTION_POOL.length;
  const idxB = (seed >> 3) % SECTION_POOL.length;
  const picks = idxA === idxB
    ? [SECTION_POOL[idxA], SECTION_POOL[(idxA + 1) % SECTION_POOL.length]]
    : [SECTION_POOL[idxA], SECTION_POOL[idxB]];

  const parsed_sections = picks.map((sec, i) => ({
    name: sec.name,
    dishes: sec.dishes.slice(0, 2 + ((seed >> (i * 2)) & 1)),
  }));

  // Confidence: 0.72 .. 0.96 deterministic
  const confidence = Math.round((0.72 + ((seed % 240) / 1000)) * 1000) / 1000;

  res.json({
    file: {
      name: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    },
    confidence,
    parsed_sections,
    generatedAt: new Date().toISOString(),
    note: 'Mock OCR — pattern matches deterministic seed of filename+size.',
  });
});

module.exports = router;
module.exports.default = router;
