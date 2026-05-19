// Apply pass 5 — POS + delivery integration adapters.
// NEEDS-CREDS: each provider requires its own OAuth credentials. Routes return
// 503 with the missing env var names when credentials are absent. With
// credentials present they would call the respective provider API; for now
// they return 501.
//
// Required env vars (per-provider):
//   Toast:     TOAST_CLIENT_ID, TOAST_CLIENT_SECRET, TOAST_RESTAURANT_GUID
//   Square:    SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID
//   Clover:    CLOVER_API_KEY,  CLOVER_MERCHANT_ID
//   DoorDash:  DOORDASH_DEVELOPER_ID, DOORDASH_KEY_ID, DOORDASH_SIGNING_SECRET
//   UberEats:  UBEREATS_CLIENT_ID, UBEREATS_CLIENT_SECRET
import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const PROVIDER_CREDS: Record<string, string[]> = {
  toast: ['TOAST_CLIENT_ID', 'TOAST_CLIENT_SECRET', 'TOAST_RESTAURANT_GUID'],
  square: ['SQUARE_ACCESS_TOKEN', 'SQUARE_LOCATION_ID'],
  clover: ['CLOVER_API_KEY', 'CLOVER_MERCHANT_ID'],
  doordash: ['DOORDASH_DEVELOPER_ID', 'DOORDASH_KEY_ID', 'DOORDASH_SIGNING_SECRET'],
  ubereats: ['UBEREATS_CLIENT_ID', 'UBEREATS_CLIENT_SECRET'],
};

function findMissing(provider: string): string[] {
  const required = PROVIDER_CREDS[provider];
  if (!required) return ['unknown-provider'];
  return required.filter((k) => !process.env[k]);
}

router.get('/status', authenticateToken, async (_req: AuthRequest, res: Response) => {
  const status: Record<string, { configured: boolean; missing: string[] }> = {};
  for (const p of Object.keys(PROVIDER_CREDS)) {
    const missing = findMissing(p);
    status[p] = { configured: missing.length === 0, missing };
  }
  res.json({ success: true, status });
});

router.post('/:provider/sync-menu', authenticateToken, async (req: AuthRequest, res: Response) => {
  const provider = String(req.params.provider).toLowerCase();
  if (!PROVIDER_CREDS[provider]) {
    res.status(400).json({ error: 'Unsupported provider', supported: Object.keys(PROVIDER_CREDS) });
    return;
  }
  const missing = findMissing(provider);
  if (missing.length > 0) {
    res.status(503).json({ error: `${provider} credentials not configured`, missing });
    return;
  }
  res.status(501).json({ error: 'Adapter present but upstream call not enabled in this build', provider });
});

router.post('/:provider/import-orders', authenticateToken, async (req: AuthRequest, res: Response) => {
  const provider = String(req.params.provider).toLowerCase();
  if (!PROVIDER_CREDS[provider]) {
    res.status(400).json({ error: 'Unsupported provider', supported: Object.keys(PROVIDER_CREDS) });
    return;
  }
  const missing = findMissing(provider);
  if (missing.length > 0) {
    res.status(503).json({ error: `${provider} credentials not configured`, missing });
    return;
  }
  res.status(501).json({ error: 'Adapter present but upstream call not enabled in this build', provider });
});

export default router;
