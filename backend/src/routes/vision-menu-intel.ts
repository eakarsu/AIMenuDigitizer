// Auto-generated feature route: vision-menu-intel
// Domain: menu vision intelligence agent — Capability: auto-extracting dishes/prices/ingredients with allergen warnings
// Mounted under: /api/vision-menu-intel
import { Router, Request, Response } from 'express';
import https from 'https';

const router = Router();

interface AIResult { success: boolean; content?: string; error?: string; usage?: any }

async function callLLM(systemPrompt: string, userPrompt: string): Promise<AIResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'OPENROUTER_API_KEY not configured. TODO: configure credentials.' };
  }
  return new Promise((resolve) => {
    const data = JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.4,
    });
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Menu Digitizer',
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) return resolve({ success: false, error: parsed.error.message || 'AI error' });
          const content = parsed.choices?.[0]?.message?.content || '';
          resolve({ success: true, content, usage: parsed.usage });
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse AI response' });
        }
      });
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.write(data);
    req.end();
  });
}

interface RunRecord { id: number; slug: string; input: any; output: any; created_at: string; user_id: any }
const store: RunRecord[] = [];

router.post('/run', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const systemPrompt = `You are a menu vision intelligence agent. Your task is auto-extracting dishes/prices/ingredients with allergen warnings. Respond with concise JSON: { "summary": string, "recommendations": string[], "next_actions": string[], "confidence": number }.`;
    const userPrompt = `Context payload: ${JSON.stringify(payload).slice(0, 4000)}`;
    const result = await callLLM(systemPrompt, userPrompt);
    if (!result.success) return res.status(503).json({ error: result.error });
    let parsed: any = null;
    try {
      const stripped = (result.content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      parsed = JSON.parse(stripped);
    } catch (e) {
      parsed = { raw: result.content };
    }
    const record: RunRecord = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      slug: 'vision-menu-intel',
      input: payload,
      output: parsed,
      created_at: new Date().toISOString(),
      user_id: (req as any).user?.id || (req as any).user?.userId || null,
    };
    store.push(record);
    if (store.length > 200) store.shift();
    res.json({ ok: true, result: parsed, id: record.id, usage: result.usage });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit), 10) || 25, 100);
  res.json({ items: store.slice(-limit).reverse() });
});

router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const item = store.find((r) => r.id === id);
  if (!item) return res.status(404).json({ error: 'not found' });
  res.json(item);
});

router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const idx = store.findIndex((r) => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  store.splice(idx, 1);
  res.json({ ok: true });
});

export default router;
