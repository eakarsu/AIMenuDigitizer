// Apply pass 5 — ingredient cost schema + cost-analysis endpoint.
// PRODUCT-DECISION: ingredient cost is per-unit (e.g., $/oz, $/g, $/each).
// menu_item_ingredients link items to ingredients with a quantity-per-serving.
// Cost-analysis is a pure DB aggregation — no AI required for the basic
// numbers; the AI variant is exposed under /api/ai/cost-analysis (separate
// file) and falls back to 503 when OPENROUTER_API_KEY is missing.
// No required env vars for the basic endpoints.
import { Router, Response } from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      unit VARCHAR(20) NOT NULL,
      cost_per_unit DECIMAL(10, 4) NOT NULL,
      vendor VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_item_ingredients (
      id SERIAL PRIMARY KEY,
      menu_item_id INTEGER,
      ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
      quantity_per_serving DECIMAL(10, 4) NOT NULL,
      UNIQUE(menu_item_id, ingredient_id)
    )
  `);
}
ensureSchema().catch((err) => console.error('ingredients ensureSchema:', err.message));

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM ingredients WHERE user_id = $1 ORDER BY name ASC', [req.userId]);
    res.json({ ingredients: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, unit, cost_per_unit, vendor } = req.body;
    if (!name || !unit || cost_per_unit == null) {
      res.status(400).json({ error: 'name, unit, and cost_per_unit are required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO ingredients (user_id, name, unit, cost_per_unit, vendor) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, name, unit, cost_per_unit, vendor || null],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/menu-item-link', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { menu_item_id, ingredient_id, quantity_per_serving } = req.body;
    if (!menu_item_id || !ingredient_id || quantity_per_serving == null) {
      res.status(400).json({ error: 'menu_item_id, ingredient_id, quantity_per_serving are required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_per_serving) VALUES ($1, $2, $3)
       ON CONFLICT (menu_item_id, ingredient_id) DO UPDATE SET quantity_per_serving = EXCLUDED.quantity_per_serving
       RETURNING *`,
      [menu_item_id, ingredient_id, quantity_per_serving],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cost analysis (no AI) — for a menuId, return per-item food cost and margin.
router.get('/analysis/:menuId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const menuId = parseInt(req.params.menuId, 10);
    if (Number.isNaN(menuId)) {
      res.status(400).json({ error: 'Invalid menuId' });
      return;
    }
    const items = await pool.query(
      `SELECT mi.id AS item_id, mi.name, mi.price,
              COALESCE(SUM(i.cost_per_unit * mii.quantity_per_serving), 0) AS food_cost
       FROM menu_items mi
       LEFT JOIN menu_item_ingredients mii ON mii.menu_item_id = mi.id
       LEFT JOIN ingredients i ON i.id = mii.ingredient_id
       WHERE mi.menu_id = $1
       GROUP BY mi.id, mi.name, mi.price
       ORDER BY mi.name`,
      [menuId],
    );
    const enriched = items.rows.map((r: any) => {
      const price = Number(r.price) || 0;
      const cost = Number(r.food_cost) || 0;
      const margin = price > 0 ? (price - cost) / price : 0;
      return {
        ...r,
        price,
        food_cost: cost,
        gross_margin_pct: Math.round(margin * 1000) / 10,
      };
    });
    res.json({ menu_id: menuId, items: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
