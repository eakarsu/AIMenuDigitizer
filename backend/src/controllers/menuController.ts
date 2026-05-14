import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { parsePagination } from '../middleware/pagination';
import { parseSearch } from '../middleware/search';
import { parseSort } from '../middleware/sort';
import pool from '../db/connection';

// ---------------------------------------------------------------------------
// Menu handlers
// ---------------------------------------------------------------------------

export async function listMenus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { search } = parseSearch(req.query);
    const { sortBy, sortOrder } = parseSort(req.query, ['created_at', 'name', 'restaurant_name', 'item_count']);

    let whereClause = 'WHERE m.user_id = $1';
    const params: any[] = [req.userId];
    let paramIndex = 2;

    if (search) {
      whereClause += ` AND (m.name ILIKE $${paramIndex} OR m.restaurant_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT m.id) FROM menus m ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const sortColumn = sortBy === 'item_count' ? 'item_count' : `m.${sortBy}`;
    const result = await pool.query(
      `SELECT m.*, COUNT(mi.id)::int as item_count
       FROM menus m
       LEFT JOIN menu_items mi ON m.id = mi.menu_id
       ${whereClause}
       GROUP BY m.id
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching menus:', error);
    res.status(500).json({ error: 'Failed to fetch menus' });
  }
}

export async function getMenu(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const menuResult = await pool.query(
      'SELECT * FROM menus WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (menuResult.rows.length === 0) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const itemsResult = await pool.query(
      `SELECT mi.*,
        COALESCE(json_agg(DISTINCT a.*) FILTER (WHERE a.id IS NOT NULL), '[]') as allergens,
        COALESCE(json_agg(DISTINCT n.*) FILTER (WHERE n.id IS NOT NULL), '[]') as nutrition,
        COALESCE(json_agg(DISTINCT t.*) FILTER (WHERE t.id IS NOT NULL), '[]') as translations
       FROM menu_items mi
       LEFT JOIN allergens a ON mi.id = a.menu_item_id
       LEFT JOIN nutrition n ON mi.id = n.menu_item_id
       LEFT JOIN translations t ON mi.id = t.menu_item_id
       WHERE mi.menu_id = $1
       GROUP BY mi.id
       ORDER BY mi.category, mi.name`,
      [id]
    );

    res.json({ ...menuResult.rows[0], items: itemsResult.rows });
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
}

export async function createMenu(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, restaurant_name, description, image_url } = req.body;

    const result = await pool.query(
      `INSERT INTO menus (name, restaurant_name, description, image_url, user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, restaurant_name, description, image_url, req.userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating menu:', error);
    res.status(500).json({ error: 'Failed to create menu' });
  }
}

export async function updateMenu(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, restaurant_name, description, image_url } = req.body;

    const result = await pool.query(
      `UPDATE menus SET name = $1, restaurant_name = $2, description = $3, image_url = $4, updated_at = NOW()
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [name, restaurant_name, description, image_url, id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating menu:', error);
    res.status(500).json({ error: 'Failed to update menu' });
  }
}

export async function deleteMenu(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM menus WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    res.json({ message: 'Menu deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu:', error);
    res.status(500).json({ error: 'Failed to delete menu' });
  }
}

export async function bulkDeleteMenus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required' });
      return;
    }

    const result = await pool.query(
      'DELETE FROM menus WHERE id = ANY($1) AND user_id = $2 RETURNING id',
      [ids, req.userId]
    );

    res.json({ message: `${result.rowCount} menus deleted`, deletedIds: result.rows.map((r) => r.id) });
  } catch (error) {
    console.error('Error bulk deleting menus:', error);
    res.status(500).json({ error: 'Failed to bulk delete menus' });
  }
}

export async function bulkUpdateMenus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required' });
      return;
    }

    const setClauses: string[] = [];
    const params: any[] = [ids, req.userId];
    let paramIndex = 3;

    if (updates.name) { setClauses.push(`name = $${paramIndex++}`); params.push(updates.name); }
    if (updates.restaurant_name) { setClauses.push(`restaurant_name = $${paramIndex++}`); params.push(updates.restaurant_name); }
    if (updates.description !== undefined) { setClauses.push(`description = $${paramIndex++}`); params.push(updates.description); }

    if (setClauses.length === 0) {
      res.status(400).json({ error: 'No valid updates provided' });
      return;
    }

    setClauses.push('updated_at = NOW()');

    const result = await pool.query(
      `UPDATE menus SET ${setClauses.join(', ')} WHERE id = ANY($1) AND user_id = $2 RETURNING *`,
      params
    );

    res.json({ message: `${result.rowCount} menus updated`, data: result.rows });
  } catch (error) {
    console.error('Error bulk updating menus:', error);
    res.status(500).json({ error: 'Failed to bulk update menus' });
  }
}

// ---------------------------------------------------------------------------
// Menu item handlers
// ---------------------------------------------------------------------------

export async function getMenuItem(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { menuId, itemId } = req.params;

    const menuCheck = await pool.query('SELECT id FROM menus WHERE id = $1 AND user_id = $2', [menuId, req.userId]);
    if (menuCheck.rows.length === 0) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const result = await pool.query(
      `SELECT mi.*,
        COALESCE(json_agg(DISTINCT a.*) FILTER (WHERE a.id IS NOT NULL), '[]') as allergens,
        COALESCE(json_agg(DISTINCT n.*) FILTER (WHERE n.id IS NOT NULL), '[]') as nutrition,
        COALESCE(json_agg(DISTINCT t.*) FILTER (WHERE t.id IS NOT NULL), '[]') as translations
       FROM menu_items mi
       LEFT JOIN allergens a ON mi.id = a.menu_item_id
       LEFT JOIN nutrition n ON mi.id = n.menu_item_id
       LEFT JOIN translations t ON mi.id = t.menu_item_id
       WHERE mi.id = $1 AND mi.menu_id = $2
       GROUP BY mi.id`,
      [itemId, menuId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
}

export async function createMenuItem(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { menuId } = req.params;
    const { name, description, price, category, image_url, is_vegetarian, is_vegan, is_gluten_free, spice_level } = req.body;

    const menuCheck = await pool.query('SELECT id FROM menus WHERE id = $1 AND user_id = $2', [menuId, req.userId]);
    if (menuCheck.rows.length === 0) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO menu_items (menu_id, name, description, price, category, image_url, is_vegetarian, is_vegan, is_gluten_free, spice_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [menuId, name, description, price, category, image_url, is_vegetarian || false, is_vegan || false, is_gluten_free || false, spice_level || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
}

export async function updateMenuItem(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { menuId, itemId } = req.params;
    const { name, description, price, category, image_url, is_vegetarian, is_vegan, is_gluten_free, spice_level } = req.body;

    const menuCheck = await pool.query('SELECT id FROM menus WHERE id = $1 AND user_id = $2', [menuId, req.userId]);
    if (menuCheck.rows.length === 0) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const result = await pool.query(
      `UPDATE menu_items SET name = $1, description = $2, price = $3, category = $4, image_url = $5,
       is_vegetarian = $6, is_vegan = $7, is_gluten_free = $8, spice_level = $9, updated_at = NOW()
       WHERE id = $10 AND menu_id = $11 RETURNING *`,
      [name, description, price, category, image_url, is_vegetarian, is_vegan, is_gluten_free, spice_level, itemId, menuId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
}

export async function deleteMenuItem(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { menuId, itemId } = req.params;

    const menuCheck = await pool.query('SELECT id FROM menus WHERE id = $1 AND user_id = $2', [menuId, req.userId]);
    if (menuCheck.rows.length === 0) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const result = await pool.query('DELETE FROM menu_items WHERE id = $1 AND menu_id = $2 RETURNING id', [itemId, menuId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
}

// ---------------------------------------------------------------------------
// Public QR menu page — GET /menus/:id/public (no auth required)
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function getPublicMenu(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lang = (req.query.lang as string) || null;
    // Return JSON if the client requests it or passes _json=1
    const wantsJson = req.headers.accept?.includes('application/json') || req.query._json === '1';

    // Fetch the menu (no user_id check — public endpoint)
    const menuResult = await pool.query(
      'SELECT id, name, restaurant_name, description FROM menus WHERE id = $1',
      [id]
    );

    if (menuResult.rows.length === 0) {
      res.status(404).json({ error: 'Menu not found' });
      return;
    }

    const menu = menuResult.rows[0];

    // Fetch items with allergens and translations
    const itemsResult = await pool.query(
      `SELECT mi.id, mi.name, mi.description, mi.price, mi.category,
              mi.is_vegetarian, mi.is_vegan, mi.is_gluten_free, mi.spice_level,
              COALESCE(json_agg(DISTINCT jsonb_build_object('name', a.name, 'severity', a.severity))
                FILTER (WHERE a.id IS NOT NULL), '[]') AS allergens,
              COALESCE(json_agg(DISTINCT jsonb_build_object(
                'language_code', t.language_code,
                'language_name', t.language_name,
                'translated_name', t.translated_name,
                'translated_description', t.translated_description
              )) FILTER (WHERE t.id IS NOT NULL), '[]') AS translations
       FROM menu_items mi
       LEFT JOIN allergens a ON mi.id = a.menu_item_id
       LEFT JOIN translations t ON mi.id = t.menu_item_id
       WHERE mi.menu_id = $1
       GROUP BY mi.id
       ORDER BY mi.category, mi.name`,
      [id]
    );

    const items = itemsResult.rows;

    // Return JSON for API consumers (React frontend public page)
    if (wantsJson) {
      res.json({ ...menu, items });
      return;
    }

    // Group items by category
    const categories: Record<string, typeof items> = {};
    for (const item of items) {
      const cat = item.category || 'Other';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    }

    const spiceIcons = ['', '🌶', '🌶🌶', '🌶🌶🌶', '🌶🌶🌶🌶'];

    function renderItem(item: any): string {
      let displayName = item.name;
      let displayDesc = item.description || '';

      // Apply translation if a language is requested and available
      if (lang) {
        const translation = (item.translations || []).find(
          (t: any) => t.language_code === lang || t.language_name?.toLowerCase() === lang.toLowerCase()
        );
        if (translation) {
          displayName = translation.translated_name || displayName;
          displayDesc = translation.translated_description || displayDesc;
        }
      }

      const badges: string[] = [];
      if (item.is_vegetarian) badges.push('<span class="badge veg">Vegetarian</span>');
      if (item.is_vegan) badges.push('<span class="badge vegan">Vegan</span>');
      if (item.is_gluten_free) badges.push('<span class="badge gf">Gluten-Free</span>');
      if (item.spice_level > 0) badges.push(`<span class="badge spice">${spiceIcons[item.spice_level] || ''}</span>`);

      const allergenList = (item.allergens || [])
        .filter((a: any) => a.name)
        .map((a: any) => `<span class="allergen ${escapeHtml(a.severity || '')}">${escapeHtml(a.name)}</span>`)
        .join('');

      const price = item.price != null ? `<span class="price">$${Number(item.price).toFixed(2)}</span>` : '';

      return `
        <div class="menu-item">
          <div class="item-header">
            <span class="item-name">${escapeHtml(displayName)}</span>
            ${price}
          </div>
          ${displayDesc ? `<p class="item-desc">${escapeHtml(displayDesc)}</p>` : ''}
          <div class="item-meta">
            ${badges.join('')}
            ${allergenList ? `<div class="allergens">${allergenList}</div>` : ''}
          </div>
        </div>`;
    }

    function renderCategories(): string {
      return Object.entries(categories)
        .map(([cat, catItems]) => `
          <section class="category">
            <h2>${escapeHtml(cat)}</h2>
            ${catItems.map(renderItem).join('')}
          </section>`)
        .join('');
    }

    const html = `<!DOCTYPE html>
<html lang="${escapeHtml(lang || 'en')}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(menu.restaurant_name || menu.name)} — Menu</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafafa; color: #1a1a1a; }
    header { background: #1a1a1a; color: #fff; padding: 1.5rem 1rem; text-align: center; }
    header h1 { font-size: 1.6rem; font-weight: 700; }
    header p { margin-top: 0.4rem; opacity: 0.75; font-size: 0.9rem; }
    main { max-width: 720px; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
    .category { margin-bottom: 2rem; }
    .category h2 { font-size: 1.15rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #555; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.4rem; margin-bottom: 1rem; }
    .menu-item { background: #fff; border-radius: 10px; padding: 1rem; margin-bottom: 0.75rem; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    .item-header { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
    .item-name { font-weight: 600; font-size: 1rem; }
    .price { font-weight: 700; color: #2d6a2d; white-space: nowrap; }
    .item-desc { color: #555; font-size: 0.87rem; margin-top: 0.35rem; line-height: 1.5; }
    .item-meta { margin-top: 0.6rem; display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .badge { font-size: 0.72rem; border-radius: 99px; padding: 0.2rem 0.55rem; font-weight: 600; }
    .badge.veg { background: #e6f4ea; color: #2d6a2d; }
    .badge.vegan { background: #d4edda; color: #155724; }
    .badge.gf { background: #fff3cd; color: #856404; }
    .badge.spice { background: #fdecea; }
    .allergens { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.1rem; }
    .allergen { font-size: 0.7rem; border-radius: 99px; padding: 0.15rem 0.5rem; }
    .allergen.high { background: #fdecea; color: #c0392b; font-weight: 700; }
    .allergen.moderate { background: #fff3cd; color: #856404; }
    .allergen.low { background: #e8f4f8; color: #1a6080; }
    footer { text-align: center; color: #aaa; font-size: 0.8rem; padding-bottom: 2rem; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(menu.restaurant_name || menu.name)}</h1>
    ${menu.description ? `<p>${escapeHtml(menu.description)}</p>` : ''}
  </header>
  <main>
    ${renderCategories()}
  </main>
  <footer>Powered by AI Menu Digitizer</footer>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error fetching public menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
}
