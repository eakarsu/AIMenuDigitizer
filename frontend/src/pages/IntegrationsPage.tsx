import { useEffect, useState } from 'react';
import { integrationsApi } from '../services/api';
import { Plug } from 'lucide-react';

export default function IntegrationsPage() {
  const [status, setStatus] = useState<Record<string, { configured: boolean; missing: string[] }> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { const r = await integrationsApi.status(); setStatus(r.data.status); }
      catch (e: any) { setError(e.response?.data?.error || 'Load failed'); }
    })();
  }, []);

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4"><Plug className="w-5 h-5" /> POS & Delivery Integrations</h1>
      <p className="text-gray-500 mb-4">Set the listed env vars on the server to enable each adapter.</p>
      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-3">{error}</div>}
      {status && Object.entries(status).map(([provider, s]) => (
        <div key={provider} className="border rounded p-3 mb-2">
          <strong className="capitalize">{provider}</strong>{' '}
          <span className={s.configured ? 'text-green-600' : 'text-red-600'}>{s.configured ? 'configured' : 'not configured'}</span>
          {!s.configured && <div className="text-sm text-gray-500 mt-1">Missing: {s.missing.join(', ')}</div>}
        </div>
      ))}
    </div>
  );
}
