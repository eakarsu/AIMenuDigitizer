import useNativeAIRequest from "../components/useNativeAIRequest";
import FormattedAIReport from "../components/FormattedAIReport";
import AIPresetButtons from '../components/AIPresetButtons';
import { useEffect, useState } from 'react';
import { aiApi, menuApi } from '../services/api';
import { Calculator } from 'lucide-react';

const COST_PRESETS = [
  { name: 'First menu', values: 0 },
  { name: 'Second menu', values: 1 },
  { name: 'Third menu', values: 2 },
];

export default function AICostAnalysisPage() {
  const nativeAIRequest = useNativeAIRequest();

  const [menus, setMenus] = useState<any[]>([]);
  const [menuId, setMenuId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    menuApi.getAll()
      .then((response) => setMenus(response.data.data || response.data || []))
      .catch(() => setError('Failed to load menus'));
  }, []);

  const submit = async () => {
    setLoading(true); setError(''); setResult(null);
    try { const r = await nativeAIRequest.run((signal) => aiApi.costAnalysis(parseInt(menuId, 10), { signal })); setResult(r.data); }
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
      <AIPresetButtons
        presets={COST_PRESETS}
        disabled={loading || nativeAIRequest.busy || menus.length === 0}
        description="Each example keeps the current real menu when selected, otherwise chooses an existing menu. No reference ID is invented."
        onSelect={(index) => setMenuId(menuId || String(menus[index % menus.length]?.id || ''))}
      />
      <div className="flex gap-2 mb-4">
        <select value={menuId} onChange={(e) => setMenuId(e.target.value)} className="border rounded px-3 py-2 flex-1">
          <option value="">Choose a menu...</option>
          {menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name} — {menu.restaurant_name}</option>)}
        </select>
        <button onClick={submit} disabled={loading || !menuId} className="bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50">{loading ? 'Analyzing…' : 'Analyze'}</button>
        {nativeAIRequest.busy && <button type="button" onClick={nativeAIRequest.cancel} className="border border-red-300 text-red-700 px-4 py-2 rounded">Cancel request</button>}
      </div>
      {result && <FormattedAIReport response={result} title="AI cost analysis" />}
    </div>
  );
}
