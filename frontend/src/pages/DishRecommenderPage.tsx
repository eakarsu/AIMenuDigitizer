import { useState, useEffect } from 'react';
import { menuApi, aiApi } from '../services/api';
import AIResultDisplay from '../components/AIResultDisplay';
import {
  Sparkles,
  Loader2,
  ChevronDown,
  Trash2,
  Eye,
  Utensils,
  Heart,
  DollarSign,
  Clock
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import DetailDrawer from '../components/DetailDrawer';
import { SkeletonTable } from '../components/Skeleton';

interface Menu {
  id: number;
  name: string;
  restaurant_name: string;
}

interface Recommendation {
  id: number;
  menu_id: number;
  customer_preferences: string;
  dietary_restrictions: string;
  recommended_items: any[];
  reasoning: string;
  meal_type: string;
  budget_range: string;
  created_at: string;
}

export default function DishRecommenderPage() {
  const { addToast } = useToast();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // Detail drawer state
  const [drawerItem, setDrawerItem] = useState<Recommendation | null>(null);

  // Confirm dialog state
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id?: number }>({ open: false });

  // Form state
  const [preferences, setPreferences] = useState('');
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [mealType, setMealType] = useState('');
  const [budget, setBudget] = useState('');

  const mealTypes = ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Late Night', 'Any'];
  const budgetOptions = ['Budget-friendly', 'Moderate', 'Premium', 'Any'];
  const restrictionOptions = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Halal', 'Kosher'];

  useEffect(() => {
    fetchMenus();
  }, []);

  useEffect(() => {
    if (selectedMenu) {
      fetchRecommendations(selectedMenu.id);
    }
  }, [selectedMenu]);

  const fetchMenus = async () => {
    try {
      const response = await menuApi.getAll();
      setMenus(response.data);
      if (response.data.length > 0) {
        setSelectedMenu(response.data[0]);
      }
    } catch (error) {
      addToast('Error fetching menus', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async (menuId: number) => {
    setRecsLoading(true);
    try {
      const response = await aiApi.getRecommendations(menuId);
      setRecommendations(response.data);
    } catch (error) {
      addToast('Error fetching recommendations', 'error');
    } finally {
      setRecsLoading(false);
    }
  };

  const handleGetRecommendations = async () => {
    if (!selectedMenu) return;

    setAnalyzing(true);
    setAiResult(null);

    try {
      const response = await aiApi.recommendDishes(
        selectedMenu.id,
        preferences,
        dietaryRestrictions,
        mealType,
        budget
      );

      setAiResult(response.data);
      addToast('Recommendations generated successfully', 'success');
      fetchRecommendations(selectedMenu.id);
    } catch (error) {
      addToast('Error getting recommendations', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await aiApi.deleteRecommendation(id);
      addToast('Recommendation deleted', 'success');
      setDrawerItem(null);
      if (selectedMenu) {
        fetchRecommendations(selectedMenu.id);
      }
    } catch (error) {
      addToast('Error deleting recommendation', 'error');
    }
    setConfirmDelete({ open: false });
  };

  const toggleRestriction = (restriction: string) => {
    const current = dietaryRestrictions.split(',').map(s => s.trim()).filter(Boolean);
    if (current.includes(restriction)) {
      setDietaryRestrictions(current.filter(r => r !== restriction).join(', '));
    } else {
      setDietaryRestrictions([...current, restriction].join(', '));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Dish Recommender</h1>
            <p className="text-gray-600">Get personalized dish recommendations based on preferences</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Panel - Preferences Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Customer Preferences</h2>

            {/* Menu Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Menu</label>
              <div className="relative">
                <select
                  value={selectedMenu?.id || ''}
                  onChange={(e) => {
                    const menu = menus.find(m => m.id === parseInt(e.target.value));
                    setSelectedMenu(menu || null);
                  }}
                  className="input-field appearance-none pr-10"
                >
                  {menus.map(menu => (
                    <option key={menu.id} value={menu.id}>
                      {menu.restaurant_name || menu.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Preferences */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Taste Preferences
              </label>
              <textarea
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                className="input-field"
                rows={2}
                placeholder="e.g., I love spicy food, prefer savory over sweet..."
              />
            </div>

            {/* Dietary Restrictions */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dietary Restrictions
              </label>
              <div className="flex flex-wrap gap-2">
                {restrictionOptions.map(restriction => (
                  <button
                    key={restriction}
                    type="button"
                    onClick={() => toggleRestriction(restriction)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      dietaryRestrictions.includes(restriction)
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {restriction}
                  </button>
                ))}
              </div>
            </div>

            {/* Meal Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Meal Type</label>
              <div className="grid grid-cols-3 gap-2">
                {mealTypes.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMealType(type)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      mealType === type
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget Range</label>
              <div className="grid grid-cols-2 gap-2">
                {budgetOptions.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBudget(b)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      budget === b
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setPreferences('I love spicy food with bold flavors, prefer savory over sweet. Enjoy grilled meats and fresh seafood.');
                setDietaryRestrictions('Gluten-Free');
                setMealType('Dinner');
                setBudget('Moderate');
              }}
              className="w-full mb-3 inline-flex items-center justify-center gap-1 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              Load Sample Data
            </button>

            <button
              onClick={handleGetRecommendations}
              disabled={!selectedMenu || analyzing}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Getting Recommendations...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Get Recommendations
                </>
              )}
            </button>
          </div>

          {/* AI Result */}
          {aiResult && (
            <div className="card p-6">
              <AIResultDisplay
                title="Dish Recommendations"
                result={aiResult}
                type="recommendation"
              />
            </div>
          )}
        </div>

        {/* Right Panel - Recommendations History */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Recommendation History</h2>
                <span className="px-3 py-1 bg-white/20 rounded-full text-white text-sm">
                  {recommendations.length} saved
                </span>
              </div>
            </div>

            {recsLoading ? (
              <SkeletonTable rows={5} />
            ) : recommendations.length === 0 ? (
              <div className="p-12 text-center">
                <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No recommendations yet</p>
                <p className="text-gray-400 text-sm mt-1">Fill in your preferences and click "Get Recommendations"</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setDrawerItem(rec)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {rec.meal_type && rec.meal_type !== 'Any' && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                              <Clock className="h-3 w-3" />
                              {rec.meal_type}
                            </span>
                          )}
                          {rec.budget_range && rec.budget_range !== 'Any' && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                              <DollarSign className="h-3 w-3" />
                              {rec.budget_range}
                            </span>
                          )}
                          {rec.dietary_restrictions && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                              <Heart className="h-3 w-3" />
                              {rec.dietary_restrictions.split(',').length} restrictions
                            </span>
                          )}
                        </div>
                        {rec.customer_preferences && (
                          <p className="text-gray-600 text-sm line-clamp-1">
                            "{rec.customer_preferences}"
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                          <Utensils className="h-4 w-4" />
                          <span>{rec.recommended_items?.length || 0} dishes recommended</span>
                          <span className="text-gray-300">|</span>
                          <span>{new Date(rec.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDrawerItem(rec); }}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete({ open: true, id: rec.id }); }}
                          className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!drawerItem}
        title="Recommendation Details"
        onClose={() => setDrawerItem(null)}
        onDelete={() => drawerItem && setConfirmDelete({ open: true, id: drawerItem.id })}
      >
        {drawerItem && (
          <div className="space-y-6">
            {/* Customer Profile */}
            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-medium text-gray-900 mb-3">Customer Profile</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Preferences:</span>
                  <p className="font-medium text-gray-900">{drawerItem.customer_preferences || 'None specified'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Restrictions:</span>
                  <p className="font-medium text-gray-900">{drawerItem.dietary_restrictions || 'None'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Meal Type:</span>
                  <p className="font-medium text-gray-900">{drawerItem.meal_type || 'Any'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Budget:</span>
                  <p className="font-medium text-gray-900">{drawerItem.budget_range || 'Any'}</p>
                </div>
              </div>
            </div>

            {/* Recommended Items */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Recommended Dishes</h3>
              <div className="space-y-3">
                {drawerItem.recommended_items?.map((item: any, i: number) => (
                  <div key={i} className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {item.rank || i + 1}
                          </span>
                          <h4 className="font-bold text-gray-900">{item.item_name}</h4>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 ml-8">{item.why_recommended}</p>
                      </div>
                      {item.price && (
                        <span className="font-bold text-green-600">${item.price?.toFixed(2)}</span>
                      )}
                    </div>
                    {item.match_score && (
                      <div className="mt-2 ml-8">
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          {item.match_score}% match
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Reasoning */}
            {drawerItem.reasoning && (
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="text-sm font-medium text-blue-700 mb-1">AI Summary</div>
                <p className="text-blue-900">{drawerItem.reasoning}</p>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Generated</label>
              <p className="text-gray-600 text-sm">{new Date(drawerItem.created_at).toLocaleString()}</p>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete.open}
        title="Delete Recommendation"
        message="Are you sure you want to delete this recommendation? This action cannot be undone."
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => confirmDelete.id && handleDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete({ open: false })}
      />
    </div>
  );
}
