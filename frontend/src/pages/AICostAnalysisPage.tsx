import { useState } from 'react';
import { aiApi } from '../services/api';
import { Calculator } from 'lucide-react';

export default function AICostAnalysisPage() {
  const [menuId, setMenuId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true); setError(''); setResult(null);
    try { const r = await aiApi.costAnalysis(parseInt(menuId, 10)); setResult(r.data); }
    catch (e: any) {
      const status = e.response?.status;
      if (status === 503) setError('AI is not configured (OPENROUTER_API_KEY missing).');
      else setError(e.response?.data?.error || 'Analysis failed');
    }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4"><Calculator className="w-5 h-5" /> AI Cost Analysis</h1>
      <p className="text-gray-500 mb-4">AI-driven cost optimization recommendations across your menu's ingredient cost data.</p>
      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-3">{error}</div>}
      <div className="flex gap-2 mb-4">
        <input type="number" placeholder="menu id" value={menuId} onChange={(e) => setMenuId(e.target.value)} className="border rounded px-3 py-2" />
        <button onClick={submit} disabled={loading || !menuId} className="bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50">{loading ? 'Analyzing…' : 'Analyze'}</button>
      </div>
      {result && <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
