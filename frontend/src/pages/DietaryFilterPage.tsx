import { useState } from 'react';
import { aiApi, menuApi } from '../services/api';
import { Loader2, Filter } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const DEFAULT_FILTERS = ['vegan', 'vegetarian', 'gluten_free', 'dairy_free', 'nut_free', 'halal', 'kosher'];

export default function DietaryFilterPage() {
  const { addToast } = useToast();
  const [menus, setMenus] = useState<any[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['vegan', 'gluten_free']);
  const [notes, setNotes] = useState('');
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

  const toggleFilter = (f: string) => {
    setSelectedFilters((cur) => cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]);
  };

  const runAnalysis = async () => {
    if (!selectedMenuId || selectedFilters.length === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await aiApi.dietaryFilterRecommendations(selectedMenuId, selectedFilters, notes || undefined);
      setResult(res.data.analysis);
      addToast('Dietary filter analysis complete!', 'success');
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
          <Filter className="h-7 w-7 text-indigo-500" />
          Dietary Filter Recommendations
        </h1>
        <p className="text-gray-600 mt-1">
          See which menu items meet dietary filters, what could be made compliant, and where you have gaps.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Menu</label>
            <select
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Filters</label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_FILTERS.map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => toggleFilter(f)}
                  className={`px-3 py-1 rounded-full text-sm border ${selectedFilters.includes(f) ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea className="input-field" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <div>
            <button
              onClick={runAnalysis}
              disabled={loading || !selectedMenuId || selectedFilters.length === 0}
              className="btn-primary flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Filter className="h-5 w-5" />}
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          {result.summary && <p className="text-gray-800">{result.summary}</p>}
          {Array.isArray(result.compliant_items) && result.compliant_items.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Already Compliant</h3>
              <ul className="list-disc pl-6 space-y-1">
                {result.compliant_items.map((c: any, i: number) => (
                  <li key={i} className="text-sm">
                    <strong>{c.name}</strong> — {c.filter} ({c.confidence})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(result.convertible_items) && result.convertible_items.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Convertible (with substitution)</h3>
              <ul className="list-disc pl-6 space-y-1">
                {result.convertible_items.map((c: any, i: number) => (
                  <li key={i} className="text-sm">
                    <strong>{c.name}</strong> ({c.filter}): {c.substitution} — {c.rationale}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(result.coverage_gaps) && result.coverage_gaps.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Coverage Gaps</h3>
              <ul className="list-disc pl-6 space-y-1">
                {result.coverage_gaps.map((c: any, i: number) => (
                  <li key={i} className="text-sm">
                    <strong>{c.filter}</strong>: {c.gap_description}
                    {Array.isArray(c.suggested_new_dishes) && c.suggested_new_dishes.length > 0 && (
                      <div className="text-xs text-gray-500 ml-2">Suggestions: {c.suggested_new_dishes.join(', ')}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details>
            <summary className="text-sm text-gray-500 cursor-pointer">Raw JSON</summary>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
