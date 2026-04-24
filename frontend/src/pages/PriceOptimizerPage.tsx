import { useState, useEffect } from 'react';
import { menuApi, aiApi } from '../services/api';
import AIResultDisplay from '../components/AIResultDisplay';
import {
  DollarSign,
  TrendingUp,
  Loader2,
  ChevronDown,
  Trash2,
  Eye,
  Sparkles
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import DetailDrawer from '../components/DetailDrawer';
import { SkeletonTable } from '../components/Skeleton';
import PriceSuggestionDetail from '../components/details/PriceSuggestionDetail';

interface Menu {
  id: number;
  name: string;
  restaurant_name: string;
  items?: MenuItem[];
}

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
}

interface PriceSuggestion {
  id: number;
  menu_item_id: number;
  item_name: string;
  description: string;
  category: string;
  current_price: number;
  suggested_price: number;
  min_price: number;
  max_price: number;
  confidence: number;
  reasoning: string;
  demand_level: string;
  created_at: string;
}

export default function PriceOptimizerPage() {
  const { addToast } = useToast();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [priceSuggestions, setPriceSuggestions] = useState<PriceSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // Detail drawer state
  const [drawerItem, setDrawerItem] = useState<PriceSuggestion | null>(null);

  // Confirm dialog state
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id?: number }>({ open: false });

  useEffect(() => {
    fetchMenus();
  }, []);

  useEffect(() => {
    if (selectedMenu) {
      fetchPriceSuggestions(selectedMenu.id);
      fetchMenuDetails(selectedMenu.id);
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

  const fetchMenuDetails = async (menuId: number) => {
    try {
      const response = await menuApi.getById(menuId);
      setSelectedMenu(response.data);
    } catch (error) {
      addToast('Error fetching menu details', 'error');
    }
  };

  const fetchPriceSuggestions = async (menuId: number) => {
    setSuggestionsLoading(true);
    try {
      const response = await aiApi.getPriceSuggestions(menuId);
      setPriceSuggestions(response.data);
    } catch (error) {
      addToast('Error fetching price suggestions', 'error');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleAnalyzePrice = async () => {
    if (!selectedItem || !selectedMenu) return;

    setAnalyzing(true);
    setAiResult(null);

    try {
      const response = await aiApi.optimizePrice(
        selectedItem.name,
        selectedItem.description || '',
        selectedItem.price,
        selectedItem.category || 'General',
        selectedItem.id
      );

      setAiResult(response.data);
      addToast('Price analysis complete', 'success');
      fetchPriceSuggestions(selectedMenu.id);
    } catch (error) {
      addToast('Error analyzing price', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await aiApi.deletePriceSuggestion(id);
      addToast('Price suggestion deleted', 'success');
      setDrawerItem(null);
      if (selectedMenu) {
        fetchPriceSuggestions(selectedMenu.id);
      }
    } catch (error) {
      addToast('Error deleting suggestion', 'error');
    }
    setConfirmDelete({ open: false });
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
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Price Optimizer</h1>
            <p className="text-gray-600">Optimize your menu prices for maximum profitability</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Panel - Analysis Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Analyze Item Price</h2>

            {/* Menu Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Menu</label>
              <div className="relative">
                <select
                  value={selectedMenu?.id || ''}
                  onChange={(e) => {
                    const menu = menus.find(m => m.id === parseInt(e.target.value));
                    setSelectedMenu(menu || null);
                    setSelectedItem(null);
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

            {/* Item Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Item</label>
              <div className="relative">
                <select
                  value={selectedItem?.id || ''}
                  onChange={(e) => {
                    const item = selectedMenu?.items?.find(i => i.id === parseInt(e.target.value));
                    setSelectedItem(item || null);
                  }}
                  className="input-field appearance-none pr-10"
                  disabled={!selectedMenu?.items?.length}
                >
                  <option value="">Choose an item...</option>
                  {selectedMenu?.items?.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} - ${item.price?.toFixed(2)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Selected Item Preview */}
            {selectedItem && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="font-medium text-gray-900">{selectedItem.name}</div>
                <div className="text-sm text-gray-600 mt-1">{selectedItem.description}</div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm text-gray-500">{selectedItem.category}</span>
                  <span className="text-lg font-bold text-green-600">${selectedItem.price?.toFixed(2)}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (selectedMenu?.items && selectedMenu.items.length > 0) {
                  setSelectedItem(selectedMenu.items[0]);
                }
              }}
              disabled={!selectedMenu?.items?.length}
              className="w-full mb-3 inline-flex items-center justify-center gap-1 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              Load Sample Data
            </button>

            <button
              onClick={handleAnalyzePrice}
              disabled={!selectedItem || analyzing}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp className="h-5 w-5" />
                  Optimize Price
                </>
              )}
            </button>
          </div>

          {/* AI Result */}
          {aiResult && (
            <div className="card p-6">
              <AIResultDisplay
                title="Price Analysis Result"
                result={aiResult}
                type="price"
              />
            </div>
          )}
        </div>

        {/* Right Panel - Price Suggestions List */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Price Suggestions</h2>
                <span className="px-3 py-1 bg-white/20 rounded-full text-white text-sm">
                  {priceSuggestions.length} suggestions
                </span>
              </div>
            </div>

            {suggestionsLoading ? (
              <SkeletonTable rows={5} />
            ) : priceSuggestions.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No price suggestions yet</p>
                <p className="text-gray-400 text-sm mt-1">Select an item and click "Optimize Price" to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {priceSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setDrawerItem(suggestion)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-gray-900">{suggestion.item_name}</h3>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {suggestion.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-gray-500">
                            Current: <span className="font-medium text-gray-700">${suggestion.current_price?.toFixed(2)}</span>
                          </span>
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            Suggested: ${suggestion.suggested_price?.toFixed(2)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            suggestion.demand_level === 'High' ? 'bg-green-100 text-green-700' :
                            suggestion.demand_level === 'Medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {suggestion.demand_level} Demand
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDrawerItem(suggestion); }}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete({ open: true, id: suggestion.id }); }}
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
        title="Price Optimization Details"
        onClose={() => setDrawerItem(null)}
        onDelete={() => drawerItem && setConfirmDelete({ open: true, id: drawerItem.id })}
      >
        {drawerItem && <PriceSuggestionDetail suggestion={drawerItem} />}
      </DetailDrawer>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete.open}
        title="Delete Price Suggestion"
        message="Are you sure you want to delete this price suggestion? This action cannot be undone."
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => confirmDelete.id && handleDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete({ open: false })}
      />
    </div>
  );
}
