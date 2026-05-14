// Apply pass 5 — multi-location data model.
// PRODUCT-DECISION: a location is owned by a user (the tenant). A menu can be
// associated with one location via `menus.location_id` (added on demand via
// ALTER TABLE; NULL means "global / no location"). RBAC for cross-tenant
// access is intentionally out of scope this pass.
// No required env vars.
import { Router, Response } from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      address TEXT,
      city VARCHAR(100),
      country VARCHAR(100),
      timezone VARCHAR(64),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Additive: allow menus.location_id without modifying existing migrate.ts
  await pool.query(`ALTER TABLE menus ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL`).catch(() => {});
}
ensureSchema().catch((err) => console.error('locations ensureSchema:', err.message));

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM locations WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
    res.json({ locations: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, city, country, timezone } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO locations (user_id, name, address, city, country, timezone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.userId, name, address || null, city || null, country || null, timezone || null],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM locations WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
