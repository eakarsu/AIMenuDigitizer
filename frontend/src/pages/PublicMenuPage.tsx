import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

interface Allergen {
  name: string;
  severity: string;
}

interface Translation {
  language_code: string;
  language_name: string;
  translated_name: string;
  translated_description: string;
}

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: string | number | null;
  category: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  spice_level: number;
  allergens: Allergen[];
  translations: Translation[];
}

interface PublicMenu {
  id: number;
  name: string;
  restaurant_name: string;
  description: string;
  items: MenuItem[];
}

const ALLERGEN_ICONS: Record<string, string> = {
  Gluten: '🌾',
  Dairy: '🥛',
  Eggs: '🥚',
  Peanuts: '🥜',
  'Tree Nuts': '🌰',
  Soy: '🫘',
  Fish: '🐟',
  Shellfish: '🦐',
  Sesame: '◉',
};

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ar', name: 'العربية' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
];

const SPICE_ICONS = ['', '🌶', '🌶🌶', '🌶🌶🌶', '🌶🌶🌶🌶'];

export default function PublicMenuPage() {
  const { id } = useParams<{ id: string }>();
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    async function fetchMenu() {
      try {
        // Fetch the JSON data from the public API endpoint
        const res = await axios.get(`/api/menus/${id}/public`, {
          headers: { Accept: 'application/json' },
          params: { _json: '1' }
        });
        setMenu(res.data);
      } catch {
        setError('Menu not found or unavailable.');
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-2xl mb-2">🍽️</p>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Menu Not Found</h1>
          <p className="text-gray-500">{error || 'This menu is not available.'}</p>
        </div>
      </div>
    );
  }

  // Group items by category
  const categories: Record<string, MenuItem[]> = {};
  for (const item of menu.items || []) {
    const cat = item.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  }

  function getDisplayName(item: MenuItem): string {
    if (language !== 'en') {
      const t = item.translations?.find(
        t => t.language_code === language || t.language_name?.toLowerCase() === language.toLowerCase()
      );
      if (t?.translated_name) return t.translated_name;
    }
    return item.name;
  }

  function getDisplayDesc(item: MenuItem): string {
    if (language !== 'en') {
      const t = item.translations?.find(
        t => t.language_code === language || t.language_name?.toLowerCase() === language.toLowerCase()
      );
      if (t?.translated_description) return t.translated_description;
    }
    return item.description || '';
  }

  function getAllergenIcon(name: string): string {
    return ALLERGEN_ICONS[name] || '⚠️';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white py-8 px-4 text-center">
        <h1 className="text-2xl font-bold">{menu.restaurant_name || menu.name}</h1>
        {menu.description && <p className="mt-2 text-gray-300 text-sm">{menu.description}</p>}
      </header>

      {/* Language Selector */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">Language:</span>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 ml-auto">
            Translations shown when available
          </span>
        </div>
      </div>

      {/* Menu Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-16">
        {Object.entries(categories).map(([cat, items]) => (
          <section key={cat} className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-200 pb-2 mb-4">
              {cat}
            </h2>
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold text-gray-900">{getDisplayName(item)}</span>
                    {item.price != null && (
                      <span className="font-bold text-green-700 whitespace-nowrap">
                        ${Number(item.price).toFixed(2)}
                      </span>
                    )}
                  </div>

                  {getDisplayDesc(item) && (
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{getDisplayDesc(item)}</p>
                  )}

                  {/* Dietary badges */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {item.is_vegetarian && (
                      <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                        🌱 Vegetarian
                      </span>
                    )}
                    {item.is_vegan && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">
                        🌿 Vegan
                      </span>
                    )}
                    {item.is_gluten_free && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 font-medium px-2 py-0.5 rounded-full">
                        GF Gluten-Free
                      </span>
                    )}
                    {item.spice_level > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
                        {SPICE_ICONS[item.spice_level] || '🌶'} Spicy
                      </span>
                    )}
                  </div>

                  {/* Allergens */}
                  {item.allergens && item.allergens.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-400 mr-1">Contains:</span>
                      {item.allergens.map((a, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded mr-1 mb-1 ${
                            a.severity === 'high'
                              ? 'bg-red-100 text-red-700'
                              : a.severity === 'moderate'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                          title={`${a.severity} severity`}
                        >
                          {getAllergenIcon(a.name)} {a.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        {Object.keys(categories).length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-4">🍽️</p>
            <p>No items on this menu yet.</p>
          </div>
        )}
      </main>

      <footer className="text-center text-gray-400 text-xs py-6">
        Powered by AI Menu Digitizer
      </footer>
    </div>
  );
}
