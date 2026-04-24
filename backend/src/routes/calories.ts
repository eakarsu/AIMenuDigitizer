import { Router, Response } from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { parsePagination } from '../middleware/pagination';
import { parseSearch } from '../middleware/search';
import { parseSort } from '../middleware/sort';

const router = Router();

// Get all nutrition info for a menu (with pagination, search, sort)
router.get('/menu/:menuId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { menuId } = req.params;
    const { page, limit, offset } = parsePagination(req.query);
    const { search } = parseSearch(req.query);
    const { sortBy, sortOrder } = parseSort(req.query, ['mi.name', 'n.calories', 'mi.category', 'n.created_at']);

    const menuCheck = await pool.query(
      'SELECT id FROM menus WHERE id = $1 AND user_id = $2',
      [menuId, req.userId]
    );

    if (menuCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    let whereClause = 'WHERE mi.menu_id = $1';
    const params: any[] = [menuId];
    let paramIndex = 2;

    if (search) {
      whereClause += ` AND (mi.name ILIKE $${paramIndex} OR mi.category ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM nutrition n JOIN menu_items mi ON n.menu_item_id = mi.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT n.*, mi.name as item_name, mi.category, mi.price
       FROM nutrition n
       JOIN menu_items mi ON n.menu_item_id = mi.id
       ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching nutrition:', error);
    res.status(500).json({ error: 'Failed to fetch nutrition data' });
  }
});

// Get nutrition for a specific menu item
router.get('/item/:itemId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    const result = await pool.query(
      `SELECT n.* FROM nutrition n JOIN menu_items mi ON n.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE n.menu_item_id = $1 AND m.user_id = $2`,
      [itemId, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nutrition data not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching nutrition:', error);
    res.status(500).json({ error: 'Failed to fetch nutrition data' });
  }
});

// Bulk delete nutrition
router.delete('/bulk', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });

    const result = await pool.query(
      `DELETE FROM nutrition WHERE id = ANY($1) AND menu_item_id IN (SELECT mi.id FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE m.user_id = $2) RETURNING id`,
      [ids, req.userId]
    );
    res.json({ message: `${result.rowCount} nutrition entries deleted`, deletedIds: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Error bulk deleting nutrition:', error);
    res.status(500).json({ error: 'Failed to bulk delete nutrition' });
  }
});

// Bulk update nutrition
router.put('/bulk', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });

    const setClauses: string[] = [];
    const params: any[] = [ids, req.userId];
    let paramIndex = 3;

    for (const field of ['calories', 'protein', 'carbohydrates', 'fat', 'fiber', 'sodium', 'sugar', 'serving_size']) {
      if (updates[field] !== undefined) { setClauses.push(`${field} = $${paramIndex++}`); params.push(updates[field]); }
    }

    if (setClauses.length === 0) return res.status(400).json({ error: 'No valid updates provided' });
    setClauses.push('updated_at = NOW()');

    const result = await pool.query(
      `UPDATE nutrition SET ${setClauses.join(', ')} WHERE id = ANY($1) AND menu_item_id IN (SELECT mi.id FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE m.user_id = $2) RETURNING *`,
      params
    );
    res.json({ message: `${result.rowCount} nutrition entries updated`, data: result.rows });
  } catch (error) {
    console.error('Error bulk updating nutrition:', error);
    res.status(500).json({ error: 'Failed to bulk update nutrition' });
  }
});

// Add or update nutrition
router.post('/', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { menu_item_id, calories, protein, carbohydrates, fat, fiber, sodium, sugar, serving_size } = req.body;
    const itemCheck = await pool.query(
      `SELECT mi.id FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE mi.id = $1 AND m.user_id = $2`,
      [menu_item_id, req.userId]
    );
    if (itemCheck.rows.length === 0) return res.status(404).json({ error: 'Menu item not found' });

    const existing = await pool.query('SELECT id FROM nutrition WHERE menu_item_id = $1', [menu_item_id]);
    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE nutrition SET calories = $1, protein = $2, carbohydrates = $3, fat = $4, fiber = $5, sodium = $6, sugar = $7, serving_size = $8, updated_at = NOW() WHERE menu_item_id = $9 RETURNING *`,
        [calories, protein, carbohydrates, fat, fiber, sodium, sugar, serving_size, menu_item_id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO nutrition (menu_item_id, calories, protein, carbohydrates, fat, fiber, sodium, sugar, serving_size) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [menu_item_id, calories, protein, carbohydrates, fat, fiber, sodium, sugar, serving_size]
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving nutrition:', error);
    res.status(500).json({ error: 'Failed to save nutrition data' });
  }
});

// Update nutrition
router.put('/:id', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { calories, protein, carbohydrates, fat, fiber, sodium, sugar, serving_size } = req.body;
    const check = await pool.query(
      `SELECT n.id FROM nutrition n JOIN menu_items mi ON n.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE n.id = $1 AND m.user_id = $2`,
      [id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Nutrition data not found' });

    const result = await pool.query(
      `UPDATE nutrition SET calories = $1, protein = $2, carbohydrates = $3, fat = $4, fiber = $5, sodium = $6, sugar = $7, serving_size = $8, updated_at = NOW() WHERE id = $9 RETURNING *`,
      [calories, protein, carbohydrates, fat, fiber, sodium, sugar, serving_size, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating nutrition:', error);
    res.status(500).json({ error: 'Failed to update nutrition data' });
  }
});

// Delete nutrition
router.delete('/:id', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const check = await pool.query(
      `SELECT n.id FROM nutrition n JOIN menu_items mi ON n.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE n.id = $1 AND m.user_id = $2`,
      [id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Nutrition data not found' });

    await pool.query('DELETE FROM nutrition WHERE id = $1', [id]);
    res.json({ message: 'Nutrition data deleted successfully' });
  } catch (error) {
    console.error('Error deleting nutrition:', error);
    res.status(500).json({ error: 'Failed to delete nutrition data' });
  }
});

export default router;
