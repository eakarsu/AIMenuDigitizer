import { useState } from 'react';
import { aiApi, menuApi } from '../services/api';
import { BarChart2, Loader2, Star, TrendingDown, TrendingUp, HelpCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface ScoredItem {
  id: number;
  name: string;
  classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog';
  reasoning: string;
  recommended_action: string;
}

interface EngineerResult {
  items: ScoredItem[];
  overall_menu_health: string;
  top_recommendations: string[];
}

const CLASSIFICATION_CONFIG = {
  Star: {
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    quadrant: 'top-right',
    icon: Star,
    label: 'Star',
    description: 'High profitability + High popularity',
    bg: 'bg-yellow-50 border-yellow-200',
  },
  Plowhorse: {
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    quadrant: 'bottom-right',
    icon: TrendingUp,
    label: 'Plowhorse',
    description: 'Low profitability + High popularity',
    bg: 'bg-blue-50 border-blue-200',
  },
  Puzzle: {
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    quadrant: 'top-left',
    icon: HelpCircle,
    label: 'Puzzle',
    description: 'High profitability + Low popularity',
    bg: 'bg-purple-50 border-purple-200',
  },
  Dog: {
    color: 'bg-red-100 text-red-800 border-red-300',
    quadrant: 'bottom-left',
    icon: TrendingDown,
    label: 'Dog',
    description: 'Low profitability + Low popularity',
    bg: 'bg-red-50 border-red-200',
  },
};

export default function MenuEngineerScorePage() {
  const { addToast } = useToast();
  const [menus, setMenus] = useState<any[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EngineerResult | null>(null);
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

  const runAnalysis = async () => {
    if (!selectedMenuId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await aiApi.menuEngineerScore(selectedMenuId);
      setResult(res.data.analysis);
      addToast('Menu engineer score complete!', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Analysis failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const byClass = (cls: ScoredItem['classification']) =>
    result?.items.filter(i => i.classification === cls) || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart2 className="h-7 w-7 text-indigo-500" />
          Menu Engineer Score
        </h1>
        <p className="text-gray-600 mt-1">
          Classify menu items as Star, Plowhorse, Puzzle, or Dog based on profitability and popularity.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
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
          <div className="flex items-end">
            <button
              onClick={runAnalysis}
              disabled={loading || !selectedMenuId}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <BarChart2 className="h-5 w-5" />}
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-sm">
          <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-4" />
          <p className="text-gray-600">Analyzing menu items...</p>
          <p className="text-sm text-gray-400 mt-1">This may take a moment</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          {/* Overall Health */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
            <h2 className="font-semibold text-indigo-900 mb-2">Overall Menu Health</h2>
            <p className="text-indigo-800">{result.overall_menu_health}</p>
          </div>

          {/* 2x2 Matrix Visualization */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4 text-lg">Menu Engineering Matrix</h2>
            <div className="grid grid-cols-2 gap-3 max-w-2xl">
              {/* Top row: Puzzle (top-left) | Star (top-right) */}
              {(['Puzzle', 'Star'] as const).map(cls => {
                const conf = CLASSIFICATION_CONFIG[cls];
                const items = byClass(cls);
                const Icon = conf.icon;
                return (
                  <div key={cls} className={`rounded-xl border-2 p-4 ${conf.bg}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-5 w-5" />
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full border ${conf.color}`}>
                        {conf.label}
                      </span>
                      <span className="ml-auto text-xs text-gray-500">{conf.description}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No items</p>
                    ) : (
                      <ul className="space-y-1">
                        {items.map(item => (
                          <li key={item.id} className="text-sm text-gray-700 font-medium">• {item.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {/* Bottom row: Dog (bottom-left) | Plowhorse (bottom-right) */}
              {(['Dog', 'Plowhorse'] as const).map(cls => {
                const conf = CLASSIFICATION_CONFIG[cls];
                const items = byClass(cls);
                const Icon = conf.icon;
                return (
                  <div key={cls} className={`rounded-xl border-2 p-4 ${conf.bg}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-5 w-5" />
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full border ${conf.color}`}>
                        {conf.label}
                      </span>
                      <span className="ml-auto text-xs text-gray-500">{conf.description}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No items</p>
                    ) : (
                      <ul className="space-y-1">
                        {items.map(item => (
                          <li key={item.id} className="text-sm text-gray-700 font-medium">• {item.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Matrix axis labels */}
            <div className="flex justify-between max-w-2xl mt-2 text-xs text-gray-400">
              <span>Low Popularity</span>
              <span>High Popularity →</span>
            </div>
          </div>

          {/* Item Detail Cards */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4 text-lg">Item Details</h2>
            <div className="space-y-3">
              {result.items.map(item => {
                const conf = CLASSIFICATION_CONFIG[item.classification];
                const Icon = conf.icon;
                return (
                  <div key={item.id} className={`rounded-lg border-2 p-4 ${conf.bg}`}>
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{item.name}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${conf.color}`}>
                            {item.classification}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{item.reasoning}</p>
                        <p className="text-xs text-gray-500 italic">
                          Recommended: {item.recommended_action}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Recommendations */}
          {result.top_recommendations && result.top_recommendations.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h2 className="font-semibold text-green-900 mb-3">Top Recommendations</h2>
              <ul className="space-y-2">
                {result.top_recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-green-800 text-sm">
                    <span className="font-bold text-green-600 mt-0.5">{i + 1}.</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
