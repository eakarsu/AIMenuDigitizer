import { Router, Response } from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { parsePagination } from '../middleware/pagination';
import { parseSearch } from '../middleware/search';
import { parseSort } from '../middleware/sort';

const router = Router();

// Get all allergens for a menu (with pagination, search, sort)
router.get('/menu/:menuId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { menuId } = req.params;
    const { page, limit, offset } = parsePagination(req.query);
    const { search } = parseSearch(req.query);
    const { sortBy, sortOrder } = parseSort(req.query, ['a.name', 'mi.name', 'a.severity', 'a.created_at']);

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
      whereClause += ` AND (a.name ILIKE $${paramIndex} OR mi.name ILIKE $${paramIndex} OR a.severity ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM allergens a JOIN menu_items mi ON a.menu_item_id = mi.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT a.*, mi.name as item_name, mi.category
       FROM allergens a
       JOIN menu_items mi ON a.menu_item_id = mi.id
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
    console.error('Error fetching allergens:', error);
    res.status(500).json({ error: 'Failed to fetch allergens' });
  }
});

// Get allergens for a specific menu item
router.get('/item/:itemId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;

    const result = await pool.query(
      `SELECT a.*
       FROM allergens a
       JOIN menu_items mi ON a.menu_item_id = mi.id
       JOIN menus m ON mi.menu_id = m.id
       WHERE a.menu_item_id = $1 AND m.user_id = $2
       ORDER BY a.severity DESC, a.name`,
      [itemId, req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching allergens:', error);
    res.status(500).json({ error: 'Failed to fetch allergens' });
  }
});

// Bulk delete allergens
router.delete('/bulk', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const result = await pool.query(
      `DELETE FROM allergens WHERE id = ANY($1) AND menu_item_id IN (
        SELECT mi.id FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE m.user_id = $2
      ) RETURNING id`,
      [ids, req.userId]
    );

    res.json({ message: `${result.rowCount} allergens deleted`, deletedIds: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Error bulk deleting allergens:', error);
    res.status(500).json({ error: 'Failed to bulk delete allergens' });
  }
});

// Bulk update allergens
router.put('/bulk', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const setClauses: string[] = [];
    const params: any[] = [ids, req.userId];
    let paramIndex = 3;

    if (updates.severity) { setClauses.push(`severity = $${paramIndex++}`); params.push(updates.severity); }
    if (updates.name) { setClauses.push(`name = $${paramIndex++}`); params.push(updates.name); }
    if (updates.description !== undefined) { setClauses.push(`description = $${paramIndex++}`); params.push(updates.description); }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    const result = await pool.query(
      `UPDATE allergens SET ${setClauses.join(', ')} WHERE id = ANY($1) AND menu_item_id IN (
        SELECT mi.id FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE m.user_id = $2
      ) RETURNING *`,
      params
    );

    res.json({ message: `${result.rowCount} allergens updated`, data: result.rows });
  } catch (error) {
    console.error('Error bulk updating allergens:', error);
    res.status(500).json({ error: 'Failed to bulk update allergens' });
  }
});

// Add allergen
router.post('/', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { menu_item_id, name, severity, description } = req.body;

    const itemCheck = await pool.query(
      `SELECT mi.id FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE mi.id = $1 AND m.user_id = $2`,
      [menu_item_id, req.userId]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const result = await pool.query(
      `INSERT INTO allergens (menu_item_id, name, severity, description) VALUES ($1, $2, $3, $4) RETURNING *`,
      [menu_item_id, name, severity || 'moderate', description]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating allergen:', error);
    res.status(500).json({ error: 'Failed to create allergen' });
  }
});

// Update allergen
router.put('/:id', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, severity, description } = req.body;

    const allergenCheck = await pool.query(
      `SELECT a.id FROM allergens a JOIN menu_items mi ON a.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE a.id = $1 AND m.user_id = $2`,
      [id, req.userId]
    );

    if (allergenCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Allergen not found' });
    }

    const result = await pool.query(
      `UPDATE allergens SET name = $1, severity = $2, description = $3 WHERE id = $4 RETURNING *`,
      [name, severity, description, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating allergen:', error);
    res.status(500).json({ error: 'Failed to update allergen' });
  }
});

// Delete allergen
router.delete('/:id', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const allergenCheck = await pool.query(
      `SELECT a.id FROM allergens a JOIN menu_items mi ON a.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE a.id = $1 AND m.user_id = $2`,
      [id, req.userId]
    );

    if (allergenCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Allergen not found' });
    }

    await pool.query('DELETE FROM allergens WHERE id = $1', [id]);
    res.json({ message: 'Allergen deleted successfully' });
  } catch (error) {
    console.error('Error deleting allergen:', error);
    res.status(500).json({ error: 'Failed to delete allergen' });
  }
});

export default router;
