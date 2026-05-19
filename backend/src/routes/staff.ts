// Apply pass 5 — staff permissions / RBAC matrix.
// PRODUCT-DECISION: 4-tier role model — admin, manager, server, kitchen.
//   admin    → full access
//   manager  → can edit menus, prices, run AI tools, view all reports
//   server   → can view menus, mark dishes 86'd, view daily specials
//   kitchen  → can view menus, view nutrition/allergens, mark prep status
// Permissions are read from a constant map; no migration is required.
// staff_assignments links a `users.id` to a `locations.id` + role. The tenant
// (location.user_id) can manage the assignment.
// No required env vars.
import { Router, Response } from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['menu:*', 'price:*', 'ai:*', 'reports:*', 'staff:*', 'integrations:*', 'location:*'],
  manager: ['menu:edit', 'menu:view', 'price:edit', 'ai:run', 'reports:view', 'staff:view'],
  server: ['menu:view', 'dish:eighty_six', 'specials:view'],
  kitchen: ['menu:view', 'nutrition:view', 'allergen:view', 'prep:update'],
};

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_assignments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      location_id INTEGER,
      role VARCHAR(50) NOT NULL,
      assigned_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, location_id)
    )
  `);
}
ensureSchema().catch((err) => console.error('staff ensureSchema:', err.message));

router.get('/roles', authenticateToken, async (_req: AuthRequest, res: Response) => {
  res.json({ roles: Object.keys(ROLE_PERMISSIONS), permissions: ROLE_PERMISSIONS });
});

router.get('/assignments', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT sa.*, u.email AS staff_email, u.name AS staff_name
       FROM staff_assignments sa LEFT JOIN users u ON u.id = sa.user_id
       WHERE sa.assigned_by = $1 OR sa.user_id = $1
       ORDER BY sa.created_at DESC`,
      [req.userId],
    );
    res.json({ assignments: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/assignments', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, location_id, role } = req.body;
    if (!user_id || !role) {
      res.status(400).json({ error: 'user_id and role are required' });
      return;
    }
    if (!ROLE_PERMISSIONS[role]) {
      res.status(400).json({ error: `Invalid role; must be one of ${Object.keys(ROLE_PERMISSIONS).join(', ')}` });
      return;
    }
    const result = await pool.query(
      `INSERT INTO staff_assignments (user_id, location_id, role, assigned_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, location_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [user_id, location_id || null, role, req.userId],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/assignments/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'DELETE FROM staff_assignments WHERE id = $1 AND assigned_by = $2 RETURNING id',
      [req.params.id, req.userId],
    );
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
