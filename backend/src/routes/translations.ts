import { Router, Response } from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { parsePagination } from '../middleware/pagination';
import { parseSearch } from '../middleware/search';
import { parseSort } from '../middleware/sort';

const router = Router();

// Get all translations for a menu (with pagination, search, sort)
router.get('/menu/:menuId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { menuId } = req.params;
    const { page, limit, offset } = parsePagination(req.query);
    const { search } = parseSearch(req.query);
    const { sortBy, sortOrder } = parseSort(req.query, ['t.language_name', 'mi.name', 't.translated_name', 't.created_at']);
    const languageFilter = req.query.filter_language_code as string;

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
      whereClause += ` AND (mi.name ILIKE $${paramIndex} OR t.translated_name ILIKE $${paramIndex} OR t.language_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (languageFilter) {
      whereClause += ` AND t.language_code = $${paramIndex}`;
      params.push(languageFilter);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM translations t JOIN menu_items mi ON t.menu_item_id = mi.id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT t.*, mi.name as original_name, mi.description as original_description, mi.category
       FROM translations t
       JOIN menu_items mi ON t.menu_item_id = mi.id
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
    console.error('Error fetching translations:', error);
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

// Get translations for a specific menu item
router.get('/item/:itemId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.params;
    const result = await pool.query(
      `SELECT t.* FROM translations t JOIN menu_items mi ON t.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE t.menu_item_id = $1 AND m.user_id = $2 ORDER BY t.language_name`,
      [itemId, req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching translations:', error);
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

// Get translations by language
router.get('/menu/:menuId/language/:langCode', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { menuId, langCode } = req.params;
    const menuCheck = await pool.query('SELECT id FROM menus WHERE id = $1 AND user_id = $2', [menuId, req.userId]);
    if (menuCheck.rows.length === 0) return res.status(404).json({ error: 'Menu not found' });

    const result = await pool.query(
      `SELECT t.*, mi.name as original_name, mi.description as original_description, mi.category, mi.price
       FROM translations t JOIN menu_items mi ON t.menu_item_id = mi.id
       WHERE mi.menu_id = $1 AND t.language_code = $2 ORDER BY mi.category, mi.name`,
      [menuId, langCode]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching translations:', error);
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

// Bulk delete translations
router.delete('/bulk', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });

    const result = await pool.query(
      `DELETE FROM translations WHERE id = ANY($1) AND menu_item_id IN (SELECT mi.id FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE m.user_id = $2) RETURNING id`,
      [ids, req.userId]
    );
    res.json({ message: `${result.rowCount} translations deleted`, deletedIds: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Error bulk deleting translations:', error);
    res.status(500).json({ error: 'Failed to bulk delete translations' });
  }
});

// Bulk update translations
router.put('/bulk', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });

    const setClauses: string[] = [];
    const params: any[] = [ids, req.userId];
    let paramIndex = 3;

    if (updates.language_code) { setClauses.push(`language_code = $${paramIndex++}`); params.push(updates.language_code); }
    if (updates.language_name) { setClauses.push(`language_name = $${paramIndex++}`); params.push(updates.language_name); }
    if (updates.translated_name) { setClauses.push(`translated_name = $${paramIndex++}`); params.push(updates.translated_name); }
    if (updates.translated_description !== undefined) { setClauses.push(`translated_description = $${paramIndex++}`); params.push(updates.translated_description); }

    if (setClauses.length === 0) return res.status(400).json({ error: 'No valid updates provided' });

    const result = await pool.query(
      `UPDATE translations SET ${setClauses.join(', ')} WHERE id = ANY($1) AND menu_item_id IN (SELECT mi.id FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE m.user_id = $2) RETURNING *`,
      params
    );
    res.json({ message: `${result.rowCount} translations updated`, data: result.rows });
  } catch (error) {
    console.error('Error bulk updating translations:', error);
    res.status(500).json({ error: 'Failed to bulk update translations' });
  }
});

// Add translation
router.post('/', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { menu_item_id, language_code, language_name, translated_name, translated_description } = req.body;
    const itemCheck = await pool.query(
      `SELECT mi.id FROM menu_items mi JOIN menus m ON mi.menu_id = m.id WHERE mi.id = $1 AND m.user_id = $2`,
      [menu_item_id, req.userId]
    );
    if (itemCheck.rows.length === 0) return res.status(404).json({ error: 'Menu item not found' });

    const existing = await pool.query('SELECT id FROM translations WHERE menu_item_id = $1 AND language_code = $2', [menu_item_id, language_code]);
    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE translations SET language_name = $1, translated_name = $2, translated_description = $3 WHERE menu_item_id = $4 AND language_code = $5 RETURNING *`,
        [language_name, translated_name, translated_description, menu_item_id, language_code]
      );
    } else {
      result = await pool.query(
        `INSERT INTO translations (menu_item_id, language_code, language_name, translated_name, translated_description) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [menu_item_id, language_code, language_name, translated_name, translated_description]
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving translation:', error);
    res.status(500).json({ error: 'Failed to save translation' });
  }
});

// Update translation
router.put('/:id', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { language_code, language_name, translated_name, translated_description } = req.body;
    const check = await pool.query(
      `SELECT t.id FROM translations t JOIN menu_items mi ON t.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE t.id = $1 AND m.user_id = $2`,
      [id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Translation not found' });

    const result = await pool.query(
      `UPDATE translations SET language_code = $1, language_name = $2, translated_name = $3, translated_description = $4 WHERE id = $5 RETURNING *`,
      [language_code, language_name, translated_name, translated_description, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating translation:', error);
    res.status(500).json({ error: 'Failed to update translation' });
  }
});

// Delete translation
router.delete('/:id', authenticateToken, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const check = await pool.query(
      `SELECT t.id FROM translations t JOIN menu_items mi ON t.menu_item_id = mi.id JOIN menus m ON mi.menu_id = m.id WHERE t.id = $1 AND m.user_id = $2`,
      [id, req.userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Translation not found' });

    await pool.query('DELETE FROM translations WHERE id = $1', [id]);
    res.json({ message: 'Translation deleted successfully' });
  } catch (error) {
    console.error('Error deleting translation:', error);
    res.status(500).json({ error: 'Failed to delete translation' });
  }
});

// Get available languages
router.get('/languages', authenticateToken, async (req: AuthRequest, res: Response) => {
  const languages = [
    { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' }, { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' }, { code: 'pt', name: 'Portuguese' }, { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' }, { code: 'ko', name: 'Korean' }, { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' }, { code: 'ru', name: 'Russian' }, { code: 'th', name: 'Thai' },
    { code: 'vi', name: 'Vietnamese' }, { code: 'nl', name: 'Dutch' }, { code: 'pl', name: 'Polish' }
  ];
  res.json(languages);
});

export default router;
