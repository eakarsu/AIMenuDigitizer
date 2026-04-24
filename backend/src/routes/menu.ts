import { Router, Response } from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { parsePagination } from '../middleware/pagination';
import { parseSearch } from '../middleware/search';
import { parseSort } from '../middleware/sort';

const router = Router();

// Get all menus (with pagination, search, sort)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
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
});

// Get single menu with items
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const menuResult = await pool.query(
      'SELECT * FROM menus WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (menuResult.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
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

    res.json({
      ...menuResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// Bulk delete menus
router.delete('/bulk', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const result = await pool.query(
      'DELETE FROM menus WHERE id = ANY($1) AND user_id = $2 RETURNING id',
      [ids, req.userId]
    );

    res.json({ message: `${result.rowCount} menus deleted`, deletedIds: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Error bulk deleting menus:', error);
    res.status(500).json({ error: 'Failed to bulk delete menus' });
  }
});

// Bulk update menus
router.put('/bulk', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const setClauses: string[] = [];
    const params: any[] = [ids, req.userId];
    let paramIndex = 3;

    if (updates.name) { setClauses.push(`name = $${paramIndex++}`); params.push(updates.name); }
    if (updates.restaurant_name) { setClauses.push(`restaurant_name = $${paramIndex++}`); params.push(updates.restaurant_name); }
    if (updates.description !== undefined) { setClauses.push(`description = $${paramIndex++}`); params.push(updates.description); }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
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
});

// Create menu
router.post('/', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
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
});

// Update menu
router.put('/:id', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, restaurant_name, description, image_url } = req.body;

    const result = await pool.query(
      `UPDATE menus SET name = $1, restaurant_name = $2, description = $3, image_url = $4, updated_at = NOW()
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [name, restaurant_name, description, image_url, id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating menu:', error);
    res.status(500).json({ error: 'Failed to update menu' });
  }
});

// Delete menu
router.delete('/:id', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM menus WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    res.json({ message: 'Menu deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu:', error);
    res.status(500).json({ error: 'Failed to delete menu' });
  }
});

// Menu Items CRUD

router.get('/:menuId/items/:itemId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { menuId, itemId } = req.params;

    const menuCheck = await pool.query(
      'SELECT id FROM menus WHERE id = $1 AND user_id = $2',
      [menuId, req.userId]
    );

    if (menuCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
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
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

router.post('/:menuId/items', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { menuId } = req.params;
    const { name, description, price, category, image_url, is_vegetarian, is_vegan, is_gluten_free, spice_level } = req.body;

    const menuCheck = await pool.query(
      'SELECT id FROM menus WHERE id = $1 AND user_id = $2',
      [menuId, req.userId]
    );

    if (menuCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
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
});

router.put('/:menuId/items/:itemId', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { menuId, itemId } = req.params;
    const { name, description, price, category, image_url, is_vegetarian, is_vegan, is_gluten_free, spice_level } = req.body;

    const menuCheck = await pool.query(
      'SELECT id FROM menus WHERE id = $1 AND user_id = $2',
      [menuId, req.userId]
    );

    if (menuCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    const result = await pool.query(
      `UPDATE menu_items SET name = $1, description = $2, price = $3, category = $4, image_url = $5,
       is_vegetarian = $6, is_vegan = $7, is_gluten_free = $8, spice_level = $9, updated_at = NOW()
       WHERE id = $10 AND menu_id = $11 RETURNING *`,
      [name, description, price, category, image_url, is_vegetarian, is_vegan, is_gluten_free, spice_level, itemId, menuId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

router.delete('/:menuId/items/:itemId', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { menuId, itemId } = req.params;

    const menuCheck = await pool.query(
      'SELECT id FROM menus WHERE id = $1 AND user_id = $2',
      [menuId, req.userId]
    );

    if (menuCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    const result = await pool.query(
      'DELETE FROM menu_items WHERE id = $1 AND menu_id = $2 RETURNING id',
      [itemId, menuId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

export default router;
