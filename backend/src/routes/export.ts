import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { createPDFTable } from '../services/pdfGenerator';

const router = Router();

// CSV Export
router.get('/csv/:type', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.params;
    const menuId = req.query.menuId as string;

    let rows: any[] = [];
    let headers: string[] = [];
    let filename = '';

    switch (type) {
      case 'menus': {
        const result = await pool.query(
          `SELECT m.name, m.restaurant_name, m.description, COUNT(mi.id)::int as item_count, m.created_at
           FROM menus m LEFT JOIN menu_items mi ON m.id = mi.menu_id
           WHERE m.user_id = $1 GROUP BY m.id ORDER BY m.name`,
          [req.userId]
        );
        headers = ['Name', 'Restaurant', 'Description', 'Items', 'Created'];
        rows = result.rows.map(r => [r.name, r.restaurant_name, r.description, r.item_count, new Date(r.created_at).toLocaleDateString()]);
        filename = 'menus.csv';
        break;
      }
      case 'allergens': {
        if (!menuId) return res.status(400).json({ error: 'menuId is required' });
        const result = await pool.query(
          `SELECT a.name, a.severity, a.description, mi.name as item_name, mi.category
           FROM allergens a JOIN menu_items mi ON a.menu_item_id = mi.id
           WHERE mi.menu_id = $1 ORDER BY mi.name, a.name`,
          [menuId]
        );
        headers = ['Item', 'Category', 'Allergen', 'Severity', 'Description'];
        rows = result.rows.map(r => [r.item_name, r.category, r.name, r.severity, r.description]);
        filename = 'allergens.csv';
        break;
      }
      case 'nutrition': {
        if (!menuId) return res.status(400).json({ error: 'menuId is required' });
        const result = await pool.query(
          `SELECT n.*, mi.name as item_name, mi.category
           FROM nutrition n JOIN menu_items mi ON n.menu_item_id = mi.id
           WHERE mi.menu_id = $1 ORDER BY mi.name`,
          [menuId]
        );
        headers = ['Item', 'Category', 'Calories', 'Protein(g)', 'Carbs(g)', 'Fat(g)', 'Fiber(g)', 'Sodium(mg)', 'Sugar(g)', 'Serving'];
        rows = result.rows.map(r => [r.item_name, r.category, r.calories, r.protein, r.carbohydrates, r.fat, r.fiber, r.sodium, r.sugar, r.serving_size]);
        filename = 'nutrition.csv';
        break;
      }
      case 'translations': {
        if (!menuId) return res.status(400).json({ error: 'menuId is required' });
        const result = await pool.query(
          `SELECT t.*, mi.name as original_name
           FROM translations t JOIN menu_items mi ON t.menu_item_id = mi.id
           WHERE mi.menu_id = $1 ORDER BY t.language_name, mi.name`,
          [menuId]
        );
        headers = ['Original', 'Language', 'Translated Name', 'Translated Description'];
        rows = result.rows.map(r => [r.original_name, r.language_name, r.translated_name, r.translated_description]);
        filename = 'translations.csv';
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    const escapeCsv = (val: any) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// PDF Export
router.get('/pdf/:type', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.params;
    const menuId = req.query.menuId as string;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.pdf"`);
    doc.pipe(res);

    let headers: string[] = [];
    let rows: string[][] = [];
    let title = '';

    switch (type) {
      case 'menus': {
        const result = await pool.query(
          `SELECT m.name, m.restaurant_name, m.description, COUNT(mi.id)::int as item_count
           FROM menus m LEFT JOIN menu_items mi ON m.id = mi.menu_id
           WHERE m.user_id = $1 GROUP BY m.id ORDER BY m.name`,
          [req.userId]
        );
        title = 'Menus Report';
        headers = ['Name', 'Restaurant', 'Description', 'Items'];
        rows = result.rows.map(r => [r.name, r.restaurant_name || '', r.description || '', String(r.item_count)]);
        break;
      }
      case 'allergens': {
        if (!menuId) { doc.end(); return res.status(400).json({ error: 'menuId required' }); }
        const result = await pool.query(
          `SELECT a.name, a.severity, a.description, mi.name as item_name
           FROM allergens a JOIN menu_items mi ON a.menu_item_id = mi.id WHERE mi.menu_id = $1 ORDER BY mi.name`,
          [menuId]
        );
        title = 'Allergens Report';
        headers = ['Item', 'Allergen', 'Severity', 'Description'];
        rows = result.rows.map(r => [r.item_name, r.name, r.severity, r.description || '']);
        break;
      }
      case 'nutrition': {
        if (!menuId) { doc.end(); return res.status(400).json({ error: 'menuId required' }); }
        const result = await pool.query(
          `SELECT n.*, mi.name as item_name FROM nutrition n JOIN menu_items mi ON n.menu_item_id = mi.id WHERE mi.menu_id = $1 ORDER BY mi.name`,
          [menuId]
        );
        title = 'Nutrition Report';
        headers = ['Item', 'Calories', 'Protein', 'Carbs', 'Fat', 'Serving'];
        rows = result.rows.map(r => [r.item_name, String(r.calories), `${r.protein}g`, `${r.carbohydrates}g`, `${r.fat}g`, r.serving_size || '']);
        break;
      }
      case 'translations': {
        if (!menuId) { doc.end(); return res.status(400).json({ error: 'menuId required' }); }
        const result = await pool.query(
          `SELECT t.*, mi.name as original_name FROM translations t JOIN menu_items mi ON t.menu_item_id = mi.id WHERE mi.menu_id = $1 ORDER BY t.language_name`,
          [menuId]
        );
        title = 'Translations Report';
        headers = ['Original', 'Language', 'Translation'];
        rows = result.rows.map(r => [r.original_name, r.language_name, r.translated_name]);
        break;
      }
      default:
        doc.end();
        return res.status(400).json({ error: 'Invalid export type' });
    }

    createPDFTable(doc, title, headers, rows);
    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

export default router;
