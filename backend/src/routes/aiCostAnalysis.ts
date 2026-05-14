// Apply pass 5 — AI-driven cost-analysis endpoint.
// PRODUCT-DECISION: this complements the deterministic /api/ingredient-costs/
// analysis/:menuId endpoint by adding AI-generated recommendations
// (substitutions, supplier consolidations, portion adjustments).
// Required env vars: OPENROUTER_API_KEY (returns 503 if missing).
import { Router, Response } from 'express';
import pool from '../db/connection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { heavyAiLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/cost-analysis', authenticateToken, heavyAiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      res.status(503).json({ error: 'OPENROUTER_API_KEY not configured', missing: 'OPENROUTER_API_KEY' });
      return;
    }
    const { menuId } = req.body;
    if (!menuId) {
      res.status(400).json({ error: 'menuId is required' });
      return;
    }

    // Pull aggregated cost rows from the deterministic analysis.
    const items = await pool.query(
      `SELECT mi.id, mi.name, mi.price,
              COALESCE(SUM(i.cost_per_unit * mii.quantity_per_serving), 0) AS food_cost,
              json_agg(json_build_object('name', i.name, 'unit', i.unit, 'qty', mii.quantity_per_serving, 'cost_per_unit', i.cost_per_unit)) FILTER (WHERE i.id IS NOT NULL) AS ingredients
       FROM menu_items mi
       LEFT JOIN menu_item_ingredients mii ON mii.menu_item_id = mi.id
       LEFT JOIN ingredients i ON i.id = mii.ingredient_id
       WHERE mi.menu_id = $1
       GROUP BY mi.id`,
      [menuId],
    );

    if (items.rows.length === 0) {
      res.status(404).json({ error: 'No menu items found for this menu' });
      return;
    }

    const prompt = `You are a restaurant cost optimization analyst. Given each menu item's price, food cost, and ingredient breakdown, return JSON with:
{
  "items": [{"id": <number>, "name": "string", "current_margin_pct": <number>, "issues": ["string"], "substitutions": ["string"], "portion_adjustments": ["string"], "supplier_consolidation": ["string"], "recommended_price": <number>, "rationale": "string"}],
  "menu_level_recommendations": ["string"],
  "summary": "string"
}
Data:
${JSON.stringify(items.rows).slice(0, 12000)}`;

    const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Menu Digitizer',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      res.status(502).json({ error: 'OpenRouter request failed', detail: errText });
      return;
    }
    const apiJson: any = await apiResponse.json();
    const content: string = apiJson?.choices?.[0]?.message?.content || '';
    let parsed: any = null;
    try { parsed = JSON.parse(content); } catch (_) {
      const stripped = content.replace(/```json?/gi, '').replace(/```/g, '').trim();
      try { parsed = JSON.parse(stripped); } catch (_) {
        const m = stripped.match(/\{[\s\S]*\}/);
        if (m) try { parsed = JSON.parse(m[0]); } catch (_) {}
      }
    }
    res.json({ success: true, analysis: parsed || { raw: content }, tokensUsed: apiJson?.usage?.total_tokens });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
