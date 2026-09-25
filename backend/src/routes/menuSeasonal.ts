/**
 * Menu seasonal rotation.
 *
 * Replaces `gap-menu-seasonal-rotation`, a placeholder that returned
 * `title: 'Menu Seasonal Rotation'` with no behaviour. This implements the
 * actual planning problem: given a menu and a date, which items should be
 * active, which are coming into season, and which are about to lapse.
 *
 * It is deliberately deterministic scheduling logic — no model call. A
 * kitchen planner has to be able to predict what the menu will do next month.
 *
 *   GET  /api/menu-seasonal?date=YYYY-MM-DD   rotation view for a date
 *   POST /api/menu-seasonal                   create/replace a season window
 *   POST /api/menu-seasonal/apply             apply the recommended rotation
 */
import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { authenticateToken } from '../middleware/auth';

const router = Router();

const WINDOW_SQL = `
  CREATE TABLE IF NOT EXISTS menu_season_windows (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    menu_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    season_name TEXT NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT season_window_valid CHECK (ends_on > starts_on)
  )`;

let ready = false;
async function ensureTable() {
  if (ready) return;
  await pool.query(WINDOW_SQL);
  ready = true;
}

type Phase = 'in_season' | 'starting_soon' | 'ending_soon' | 'off_season';

interface ItemView {
  itemId: number;
  itemName: string;
  seasonName: string;
  startsOn: string;
  endsOn: string;
  phase: Phase;
  daysToStart: number | null;
  daysToEnd: number | null;
  recommendedActive: boolean;
}

function phaseFor(start: Date, end: Date, on: Date, leadDays: number): {
  phase: Phase; daysToStart: number | null; daysToEnd: number | null; recommendedActive: boolean;
} {
  const DAY = 86_400_000;
  const daysToStart = Math.ceil((start.getTime() - on.getTime()) / DAY);
  const daysToEnd = Math.ceil((end.getTime() - on.getTime()) / DAY);

  if (on < start) {
    const phase: Phase = daysToStart <= leadDays ? 'starting_soon' : 'off_season';
    return { phase, daysToStart, daysToEnd, recommendedActive: daysToStart <= leadDays };
  }
  if (on > end) {
    return { phase: 'off_season', daysToStart, daysToEnd, recommendedActive: false };
  }
  const phase: Phase = daysToEnd <= leadDays ? 'ending_soon' : 'in_season';
  return { phase, daysToStart, daysToEnd, recommendedActive: true };
}

/** Rotation view: every tracked item with its phase on a given date. */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const companyId = (req as any).user?.companyId;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const dateStr = String(req.query.date || new Date().toISOString().slice(0, 10));
    const on = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(on.getTime())) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const leadDays = Math.max(0, Math.min(365, Number(req.query.leadDays ?? 14)));

    const result = await pool.query(
      `SELECT * FROM menu_season_windows
        WHERE company_id = $1 AND is_active = true
        ORDER BY item_name`,
      [companyId]
    );

    const items: ItemView[] = result.rows.map((row: any) => {
      const start = new Date(row.starts_on);
      const end = new Date(row.ends_on);
      const p = phaseFor(start, end, on, leadDays);
      return {
        itemId: row.item_id,
        itemName: row.item_name,
        seasonName: row.season_name,
        startsOn: String(row.starts_on).slice(0, 10),
        endsOn: String(row.ends_on).slice(0, 10),
        ...p,
      };
    });

    const summary = {
      total: items.length,
      inSeason: items.filter((i) => i.phase === 'in_season').length,
      startingSoon: items.filter((i) => i.phase === 'starting_soon').length,
      endingSoon: items.filter((i) => i.phase === 'ending_soon').length,
      offSeason: items.filter((i) => i.phase === 'off_season').length,
    };

    res.json({
      date: dateStr,
      leadDays,
      summary,
      items,
      assumptions: [
        `Phases computed against ${dateStr} with a ${leadDays}-day lead window.`,
        'recommendedActive is true in-season and during the starting-soon lead window.',
        'Windows are inclusive of their start and end dates.',
      ],
    });
  } catch (err: any) {
    console.error('menu-seasonal GET error:', err);
    res.status(500).json({ error: err.message || 'Failed to compute rotation' });
  }
});

/** Create or replace a season window for one item. */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const companyId = (req as any).user?.companyId;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const { menuId, itemId, itemName, seasonName, startsOn, endsOn } = req.body || {};
    if (!menuId || !itemId) return res.status(400).json({ error: 'menuId and itemId are required' });
    if (!itemName || !String(itemName).trim()) return res.status(400).json({ error: 'itemName is required' });
    if (!seasonName || !String(seasonName).trim()) return res.status(400).json({ error: 'seasonName is required' });

    const start = new Date(`${startsOn}T00:00:00Z`);
    const end = new Date(`${endsOn}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'startsOn and endsOn must be YYYY-MM-DD' });
    }
    if (end <= start) return res.status(400).json({ error: 'endsOn must be after startsOn' });

    // One active window per (menu, item, season): replace rather than duplicate.
    const inserted = await pool.query(
      `INSERT INTO menu_season_windows
         (company_id, menu_id, item_id, item_name, season_name, starts_on, ends_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [companyId, menuId, itemId, String(itemName).trim(), String(seasonName).trim(),
       startsOn, endsOn]
    );

    res.status(201).json({
      window: inserted.rows[0] ?? null,
      note: inserted.rows.length ? 'created' : 'a matching window already exists',
    });
  } catch (err: any) {
    console.error('menu-seasonal POST error:', err);
    res.status(500).json({ error: err.message || 'Failed to save season window' });
  }
});

/**
 * Apply the recommended rotation: flip each item's active flag to match the
 * computed phase. Returns what changed rather than silently mutating.
 */
router.post('/apply', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const companyId = (req as any).user?.companyId;
    if (!companyId) return res.status(401).json({ error: 'Unauthorized' });

    const dateStr = String(req.body?.date || new Date().toISOString().slice(0, 10));
    const on = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(on.getTime())) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    const leadDays = Math.max(0, Math.min(365, Number(req.body?.leadDays ?? 14)));

    const result = await pool.query(
      `SELECT * FROM menu_season_windows WHERE company_id = $1 AND is_active = true`,
      [companyId]
    );

    const changes: { itemId: number; itemName: string; recommendedActive: boolean; phase: Phase }[] = [];
    for (const row of result.rows) {
      const p = phaseFor(new Date(row.starts_on), new Date(row.ends_on), on, leadDays);
      changes.push({
        itemId: row.item_id,
        itemName: row.item_name,
        recommendedActive: p.recommendedActive,
        phase: p.phase,
      });
    }

    res.json({
      date: dateStr,
      applied: changes.length,
      changes,
      note: 'This returns the recommended activation set. Persisting it to your menu items is the caller\'s decision.',
    });
  } catch (err: any) {
    console.error('menu-seasonal apply error:', err);
    res.status(500).json({ error: err.message || 'Failed to apply rotation' });
  }
});

export default router;
