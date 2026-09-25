/**
 * Guest, ordering, waste and webhook services.
 *
 * Replaces five `gap-*` placeholders (guest, guest-preference-personalization,
 * order, waste-reduction-advisor, webhooks) that returned only their slug.
 *
 * Design rules applied throughout:
 *   - deterministic arithmetic over menu/ingredient rows, no model calls
 *   - where the data is too thin to support a number, say so
 *   - every webhook delivery is idempotent and retryable, never fire-and-forget
 */
import { Router, Request, Response } from 'express';
import pool from '../db/connection';
import { authenticateToken } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_guests (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      external_ref TEXT,
      display_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      party_size INTEGER DEFAULT 2,
      visits INTEGER NOT NULL DEFAULT 0,
      last_visit_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS menu_guest_preferences (
      id SERIAL PRIMARY KEY,
      guest_id INTEGER NOT NULL REFERENCES menu_guests(id) ON DELETE CASCADE,
      preference_type TEXT NOT NULL,
      preference_value TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'preference',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS menu_orders (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      guest_id INTEGER REFERENCES menu_guests(id) ON DELETE SET NULL,
      location_id INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
      tax NUMERIC(12,2) NOT NULL DEFAULT 0,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      placed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS menu_order_lines (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES menu_orders(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      line_total NUMERIC(12,2) NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS menu_waste_events (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      item_id INTEGER,
      item_name TEXT NOT NULL,
      quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'serving',
      reason TEXT,
      cost_impact NUMERIC(12,2),
      recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS menu_webhook_endpoints (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      secret_hash TEXT NOT NULL,
      event_type TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS menu_webhook_deliveries (
      id SERIAL PRIMARY KEY,
      endpoint_id INTEGER NOT NULL REFERENCES menu_webhook_endpoints(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      delivered_at TIMESTAMP,
      UNIQUE (endpoint_id, idempotency_key)
    );
  `);
}

let ready = false;
async function ready_() { if (!ready) { await ensureTables(); ready = true; } }

/* ------------------------------ guests ------------------------------ */

router.get('/guests', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ready_();
    const companyId = (req as any).user?.companyId;
    const rows = await pool.query(
      `SELECT g.*, COALESCE(json_agg(p.* ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), '[]') AS preferences
         FROM menu_guests g
         LEFT JOIN menu_guest_preferences p ON p.guest_id = g.id
        WHERE g.company_id = $1
        GROUP BY g.id ORDER BY g.display_name LIMIT 500`,
      [companyId]
    );
    res.json({ guests: rows.rows });
  } catch (e: any) {
    console.error('guests GET error:', e);
    res.status(500).json({ error: e.message || 'Failed to list guests' });
  }
});

router.post('/guests', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ready_();
    const companyId = (req as any).user?.companyId;
    const { displayName, email, phone, externalRef, partySize } = req.body || {};
    if (!displayName || !String(displayName).trim()) {
      return res.status(400).json({ error: 'displayName is required' });
    }
    const inserted = await pool.query(
      `INSERT INTO menu_guests (company_id, external_ref, display_name, email, phone, party_size)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [companyId, externalRef ?? null, String(displayName).trim(),
       email ?? null, phone ?? null, partySize ?? 2]
    );
    res.status(201).json({ guest: inserted.rows[0] });
  } catch (e: any) {
    console.error('guests POST error:', e);
    res.status(500).json({ error: e.message || 'Failed to create guest' });
  }
});

/**
 * Personalisation: given a guest's recorded preferences and a menu, return
 * which items suit them and which conflict. This is set logic against
 * preference rows — the reason an item is flagged is always the preference
 * that flagged it.
 */
router.post('/guests/:id/personalize', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ready_();
    const companyId = (req as any).user?.companyId;
    const guest = await pool.query(
      `SELECT * FROM menu_guests WHERE id = $1 AND company_id = $2`,
      [req.params.id, companyId]
    );
    if (!guest.rows.length) return res.status(404).json({ error: 'Guest not found' });

    const prefs = await pool.query(
      `SELECT * FROM menu_guest_preferences WHERE guest_id = $1`,
      [req.params.id]
    );

    const items: any[] = Array.isArray(req.body?.items) ? req.body.items : [];
    const scored = items.map((item: any) => {
      const text = `${item?.name ?? ''} ${item?.description ?? ''} ${Array.isArray(item?.ingredients) ? item.ingredients.join(' ') : ''}`.toLowerCase();
      const conflicts: string[] = [];
      const matches: string[] = [];
      for (const p of prefs.rows) {
        const needle = String(p.preference_value).toLowerCase();
        if (!needle) continue;
        const hit = text.includes(needle);
        if (p.severity === 'allergy' || p.severity === 'avoid') {
          if (hit) conflicts.push(`${p.severity}: ${p.preference_value}`);
        } else if (hit) {
          matches.push(`prefers ${p.preference_value}`);
        }
      }
      return {
        itemId: item?.id ?? null,
        itemName: item?.name ?? null,
        suitable: conflicts.length === 0,
        conflicts,
        matches,
      };
    });

    res.json({
      guest: { id: guest.rows[0].id, displayName: guest.rows[0].display_name },
      preferenceCount: prefs.rows.length,
      items: scored,
      safeCount: scored.filter((s) => s.suitable).length,
      blockedCount: scored.filter((s) => !s.suitable).length,
      assumptions: [
        'Matching is exact term matching against item name, description and ingredient text.',
        'Allergy/avoid preferences block an item; other preferences annotate it.',
        'An item with no matched terms is left suitable — absence of a preference is not a conflict.',
      ],
    });
  } catch (e: any) {
    console.error('personalize error:', e);
    res.status(500).json({ error: e.message || 'Personalization failed' });
  }
});

router.post('/guests/:id/preferences', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ready_();
    const companyId = (req as any).user?.companyId;
    const g = await pool.query(`SELECT id FROM menu_guests WHERE id = $1 AND company_id = $2`, [req.params.id, companyId]);
    if (!g.rows.length) return res.status(404).json({ error: 'Guest not found' });

    const { preferenceType, preferenceValue, severity } = req.body || {};
    if (!preferenceType || !preferenceValue) {
      return res.status(400).json({ error: 'preferenceType and preferenceValue are required' });
    }
    const allowed = ['preference', 'avoid', 'allergy'];
    const sev = allowed.includes(severity) ? severity : 'preference';

    const r = await pool.query(
      `INSERT INTO menu_guest_preferences (guest_id, preference_type, preference_value, severity)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, String(preferenceType).trim(), String(preferenceValue).trim(), sev]
    );
    res.status(201).json({ preference: r.rows[0] });
  } catch (e: any) {
    console.error('preference POST error:', e);
    res.status(500).json({ error: e.message || 'Failed to record preference' });
  }
});

/* ------------------------------ orders ------------------------------ */

const ORDER_FLOW: Record<string, string[]> = {
  open: ['placed', 'cancelled'],
  placed: ['in_progress', 'cancelled'],
  in_progress: ['served', 'cancelled'],
  served: ['paid'],
  paid: [],
  cancelled: [],
};

router.post('/orders', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ready_();
    const companyId = (req as any).user?.companyId;
    const { guestId, locationId, lines, taxRate } = req.body || {};
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'lines must be a non-empty array' });
    }

    let subtotal = 0;
    const normalised = lines.map((l: any, i: number) => {
      const qty = Number(l?.qty ?? 1);
      const unit = Number(l?.unitPrice ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error(`lines[${i}].qty must be > 0`);
      if (!Number.isFinite(unit) || unit < 0) throw new Error(`lines[${i}].unitPrice must be >= 0`);
      const lineTotal = Number((qty * unit).toFixed(2));
      subtotal += lineTotal;
      return {
        itemId: Number(l?.itemId ?? i),
        itemName: String(l?.itemName ?? `item ${i}`).slice(0, 255),
        qty, unitPrice: unit, lineTotal,
      };
    });

    const rate = Number(taxRate ?? 0);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      return res.status(400).json({ error: 'taxRate must be between 0 and 1' });
    }
    const tax = Number((subtotal * rate).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    const order = await pool.query(
      `INSERT INTO menu_orders (company_id, guest_id, location_id, subtotal, tax, total)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [companyId, guestId ?? null, locationId ?? null, subtotal, tax, total]
    );

    for (const l of normalised) {
      await pool.query(
        `INSERT INTO menu_order_lines (order_id, item_id, item_name, qty, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.rows[0].id, l.itemId, l.itemName, l.qty, l.unitPrice, l.lineTotal]
      );
    }

    if (guestId) {
      await pool.query(
        `UPDATE menu_guests SET visits = visits + 1, last_visit_at = NOW() WHERE id = $1`,
        [guestId]
      );
    }

    res.status(201).json({
      order: order.rows[0],
      lines: normalised,
      totals: { subtotal, tax, total, taxRate: rate },
    });
  } catch (e: any) {
    console.error('orders POST error:', e);
    res.status(500).json({ error: e.message || 'Failed to create order' });
  }
});

router.post('/orders/:id/transition', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ready_();
    const companyId = (req as any).user?.companyId;
    const current = await pool.query(`SELECT * FROM menu_orders WHERE id = $1 AND company_id = $2`, [req.params.id, companyId]);
    if (!current.rows.length) return res.status(404).json({ error: 'Order not found' });

    const from = String(current.rows[0].status);
    const to = String(req.body?.status ?? '');
    if (!ORDER_FLOW[from]?.includes(to)) {
      return res.status(409).json({ error: `Cannot move an order from "${from}" to "${to}"`, allowed: ORDER_FLOW[from] ?? [] });
    }
    const r = await pool.query(
      `UPDATE menu_orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, to]
    );
    res.json({ order: r.rows[0], from, to });
  } catch (e: any) {
    console.error('order transition error:', e);
    res.status(500).json({ error: e.message || 'Failed to transition order' });
  }
});

/* -------------------------- waste reduction ------------------------- */

/**
 * Waste advice from recorded waste events. Ranked by cost impact, with a
 * per-item trend so a kitchen can see whether waste is one-off or repeated.
 */
router.get('/waste/advice', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ready_();
    const companyId = (req as any).user?.companyId;
    const days = Math.max(1, Math.min(365, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await pool.query(
      `SELECT item_id, item_name,
              COUNT(*) AS events,
              SUM(quantity)::float AS quantity,
              SUM(COALESCE(cost_impact,0))::float AS cost_impact,
              MIN(recorded_at) AS first_seen,
              MAX(recorded_at) AS last_seen
         FROM menu_waste_events
        WHERE company_id = $1 AND recorded_at >= $2
        GROUP BY item_id, item_name
        ORDER BY SUM(COALESCE(cost_impact,0)) DESC NULLS LAST
        LIMIT 100`,
      [companyId, since]
    );

    const totalCost = rows.rows.reduce((s: number, r: any) => s + Number(r.cost_impact ?? 0), 0);
    const advice = rows.rows.map((r: any) => {
      const events = Number(r.events);
      const recurring = events >= 3;
      return {
        itemId: r.item_id,
        itemName: r.item_name,
        events,
        quantity: Number(r.quantity ?? 0),
        costImpact: Number(r.cost_impact ?? 0),
        shareOfWasteCostPct: totalCost > 0 ? Number(((Number(r.cost_impact ?? 0) / totalCost) * 100).toFixed(2)) : null,
        recurring,
        recommendation: recurring
          ? `Recurring waste (${events} events in ${days}d) — reduce batch size or review prep forecast for this item.`
          : `One-off or low-frequency waste (${events} event(s)) — check handling and storage before changing prep.`,
      };
    });

    res.json({
      windowDays: days,
      totalCost: Number(totalCost.toFixed(2)),
      items: advice,
      assumptions: [
        `Cost impact summed over the trailing ${days} days from recorded waste events.`,
        'recurring is true at 3 or more events in the window.',
        'No spoilage-rate or sales forecast is assumed; advice reflects recorded waste only.',
      ],
    });
  } catch (e: any) {
    console.error('waste advice error:', e);
    res.status(500).json({ error: e.message || 'Failed to compute waste advice' });
  }
});

router.post('/waste', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ready_();
    const companyId = (req as any).user?.companyId;
    const { itemId, itemName, quantity, unit, reason, costImpact } = req.body || {};
    if (!itemName || !String(itemName).trim()) return res.status(400).json({ error: 'itemName is required' });
    const q = Number(quantity ?? 0);
    if (!Number.isFinite(q) || q <= 0) return res.status(400).json({ error: 'quantity must be > 0' });

    const r = await pool.query(
      `INSERT INTO menu_waste_events (company_id, item_id, item_name, quantity, unit, reason, cost_impact)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [companyId, itemId ?? null, String(itemName).trim(), q, unit ?? 'serving',
       reason ?? null, costImpact != null ? Number(costImpact) : null]
    );
    res.status(201).json({ waste: r.rows[0] });
  } catch (e: any) {
    console.error('waste POST error:', e);
    res.status(500).json({ error: e.message || 'Failed to record waste' });
  }
});

/* ----------------------------- webhooks ----------------------------- */

router.post('/webhooks/endpoints', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ready_();
    const companyId = (req as any).user?.companyId;
    const { url, eventType, secret } = req.body || {};
    if (!url || !/^https?:\/\//.test(String(url))) return res.status(400).json({ error: 'url must be http(s)' });
    if (!eventType) return res.status(400).json({ error: 'eventType is required' });
    if (!secret || String(secret).length < 16) {
      return res.status(400).json({ error: 'secret must be at least 16 characters' });
    }
    // Store a hash only — the plaintext never persists.
    const secretHash = crypto.createHash('sha256').update(String(secret)).digest('hex');
    const r = await pool.query(
      `INSERT INTO menu_webhook_endpoints (company_id, url, secret_hash, event_type)
       VALUES ($1,$2,$3,$4) RETURNING id, company_id, url, event_type, is_active, created_at`,
      [companyId, String(url), secretHash, String(eventType)]
    );
    res.status(201).json({
      endpoint: r.rows[0],
      note: 'Secret is stored as a SHA-256 hash and cannot be recovered. Use it to verify X-Menu-Signature on delivery.',
    });
  } catch (e: any) {
    console.error('webhook endpoint error:', e);
    res.status(500).json({ error: e.message || 'Failed to register endpoint' });
  }
});

/**
 * Queue a delivery. Idempotent on (endpoint, idempotencyKey): a retried emit
 * cannot double-deliver.
 */
router.post('/webhooks/emit', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ready_();
    const companyId = (req as any).user?.companyId;
    const { eventType, payload, idempotencyKey } = req.body || {};
    if (!eventType) return res.status(400).json({ error: 'eventType is required' });
    const key = String(idempotencyKey ?? `${eventType}:${Date.now()}:${Math.random()}`);

    const endpoints = await pool.query(
      `SELECT id, url FROM menu_webhook_endpoints
        WHERE company_id = $1 AND event_type = $2 AND is_active = true`,
      [companyId, String(eventType)]
    );
    if (!endpoints.rows.length) {
      return res.json({ queued: 0, deliveries: [], note: 'No active endpoint registered for this event type.' });
    }

    const body = JSON.stringify(payload ?? {});
    const deliveries = [];
    for (const ep of endpoints.rows) {
      const r = await pool.query(
        `INSERT INTO menu_webhook_deliveries (endpoint_id, event_type, payload, idempotency_key)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (endpoint_id, idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
         RETURNING id, endpoint_id, event_type, status, attempts, idempotency_key`,
        [ep.id, String(eventType), body, key]
      );
      deliveries.push({ ...r.rows[0], url: ep.url });
    }

    res.status(202).json({
      queued: deliveries.length,
      deliveries,
      idempotencyKey: key,
      note: 'Deliveries are queued for dispatch. Replaying the same idempotencyKey does not create duplicates.',
    });
  } catch (e: any) {
    console.error('webhook emit error:', e);
    res.status(500).json({ error: e.message || 'Failed to queue delivery' });
  }
});

router.get('/webhooks/deliveries', authenticateToken, async (req: Request, res: Response) => {
  try {
    await ready_();
    const companyId = (req as any).user?.companyId;
    const r = await pool.query(
      `SELECT d.id, d.event_type, d.status, d.attempts, d.last_error, d.idempotency_key,
              d.created_at, d.delivered_at, e.url
         FROM menu_webhook_deliveries d
         JOIN menu_webhook_endpoints e ON e.id = d.endpoint_id
        WHERE e.company_id = $1
        ORDER BY d.created_at DESC LIMIT 200`,
      [companyId]
    );
    res.json({ deliveries: r.rows });
  } catch (e: any) {
    console.error('webhook deliveries error:', e);
    res.status(500).json({ error: e.message || 'Failed to list deliveries' });
  }
});

export default router;