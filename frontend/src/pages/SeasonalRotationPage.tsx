import useNativeAIRequest from "../components/useNativeAIRequest";
import FormattedAIReport from "../components/FormattedAIReport";
import AIPresetButtons from '../components/AIPresetButtons';
import { useEffect, useState } from 'react';
import { aiApi, menuApi } from '../services/api';
import { Loader2, Leaf } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const SEASONAL_PRESETS = [
  { name: 'Spring refresh', values: { season: 'Spring', region: 'Pacific Northwest; prioritize asparagus, peas, rhubarb, and weather-flexible sourcing.' } },
  { name: 'Summer patio', values: { season: 'Summer', region: 'Northeast coast; prioritize tomatoes, corn, berries, seafood, and lighter preparations.' } },
  { name: 'Winter comfort', values: { season: 'Winter', region: 'Upper Midwest; prioritize storage crops, braises, preserved produce, and dependable suppliers.' } },
];

export default function SeasonalRotationPage() {
  const nativeAIRequest = useNativeAIRequest();

  const { addToast } = useToast();
  const [menus, setMenus] = useState<any[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [season, setSeason] = useState('Summer');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [menusLoaded, setMenusLoaded] = useState(false);

  const loadMenus = async () => {
    if (menusLoaded) return;
    try {
      const res = await menuApi.getAll();
      setMenus(res.data.data || res.data);
      setMenusLoaded(true);
    } catch {
      addToast('Failed to load menus', 'error');
    }
  };

  useEffect(() => { loadMenus(); }, []);

  const runAnalysis = async () => {
    if (!selectedMenuId || !season) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await nativeAIRequest.run((signal) => aiApi.menuSeasonalRotation(selectedMenuId, season, region || undefined, { signal }));
      setResult(res.data.analysis);
      addToast('Seasonal rotation plan ready!', 'success');
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || 'Analysis failed';
      if (status === 503) {
        addToast('AI is not configured (OPENROUTER_API_KEY missing).', 'error');
      } else {
        addToast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Leaf className="h-7 w-7 text-green-500" />
          Seasonal Menu Rotation
        </h1>
        <p className="text-gray-600 mt-1">
          Suggest items to keep, retire, and add for the next season.
        </p>
      </div>

      <AIPresetButtons
        presets={SEASONAL_PRESETS}
        disabled={nativeAIRequest.busy || menus.length === 0}
        description="Each example keeps the current real menu when selected, otherwise chooses an existing menu, and fills the season plus optional region context."
        onSelect={(values, index) => {
          setSelectedMenuId(selectedMenuId || menus[index % menus.length]?.id || null);
          setSeason(values.season);
          setRegion(values.region);
        }}
      />

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Menu</label>
            <select data-ai-field="selectedMenuId"
              className="input-field"
              value={selectedMenuId || ''}
              onChange={e => setSelectedMenuId(Number(e.target.value))}
              onFocus={loadMenus}
            >
              <option value="">Choose a menu...</option>
              {menus.map(m => (
                <option key={m.id} value={m.id}>{m.name} — {m.restaurant_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
            <select data-ai-field="season" className="input-field" value={season} onChange={e => setSeason(e.target.value)}>
              {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region (optional)</label>
            <input data-ai-field="region" className="input-field" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Pacific Northwest" />
          </div>

          <div>
            <button
              onClick={runAnalysis}
              disabled={loading || !selectedMenuId || !season}
              className="btn-primary flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Leaf className="h-5 w-5" />}
              {loading ? 'Generating...' : 'Generate Rotation Plan'}
            </button>
            {nativeAIRequest.busy && <button type="button" onClick={nativeAIRequest.cancel} className="ml-2 border border-red-300 text-red-700 rounded px-3 py-2">Cancel request</button>}
          </div>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          {result.summary && <p className="text-gray-800">{result.summary}</p>}
          {Array.isArray(result.keep) && result.keep.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Keep</h3>
              <ul className="list-disc pl-6 space-y-1">
                {result.keep.map((c: any, i: number) => (
                  <li key={i} className="text-sm"><strong>{c.name}</strong> — {c.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(result.retire) && result.retire.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Retire</h3>
              <ul className="list-disc pl-6 space-y-1">
                {result.retire.map((c: any, i: number) => (
                  <li key={i} className="text-sm"><strong>{c.name}</strong> — {c.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(result.add) && result.add.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Add</h3>
              <ul className="list-disc pl-6 space-y-1">
                {result.add.map((c: any, i: number) => (
                  <li key={i} className="text-sm">
                    <strong>{c.name}</strong> ({c.category}, ~${c.estimated_price}) — {c.rationale}
                    {Array.isArray(c.key_ingredients) && c.key_ingredients.length > 0 && (
                      <div className="text-xs text-gray-500 ml-2">Key: {c.key_ingredients.join(', ')}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.menu_balance_notes && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Balance Notes</h3>
              <p className="text-sm text-gray-700">{result.menu_balance_notes}</p>
            </div>
          )}
          <details>
            <summary className="text-sm text-gray-500 cursor-pointer">Complete report</summary>
            <FormattedAIReport response={result} />
          </details>
        </div>
      )}
    </div>
  );
}
