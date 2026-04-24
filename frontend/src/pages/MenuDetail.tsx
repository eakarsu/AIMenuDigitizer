import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { menuApi, aiApi, allergenApi, nutritionApi, translationApi } from '../services/api';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  X,
  Leaf,
  Flame,
  Wheat,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Languages,
  Utensils,
  Brain,
  Loader2,
  Sparkles,
  Save,
  Check
} from 'lucide-react';
import AIResultDisplay from '../components/AIResultDisplay';

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: string;
  category: string;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  spice_level: number;
  allergens: any[];
  nutrition: any[];
  translations: any[];
}

interface Menu {
  id: number;
  name: string;
  restaurant_name: string;
  description: string;
  items: MenuItem[];
}

export default function MenuDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    spice_level: 0
  });

  // AI States
  const [aiLoading, setAILoading] = useState<{ [key: string]: boolean }>({});
  const [aiResults, setAIResults] = useState<{ [key: string]: any }>({});
  const [showAIModal, setShowAIModal] = useState<{ type: string; item: MenuItem } | null>(null);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [saved, setSaved] = useState<{ [key: string]: boolean }>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, item: '' });
  const [bulkComplete, setBulkComplete] = useState(false);
  const [bulkResults, setBulkResults] = useState<any[]>([]);
  const [showBulkResultsModal, setShowBulkResultsModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchMenu();
    }
  }, [id]);

  const fetchMenu = async () => {
    try {
      const response = await menuApi.getById(Number(id));
      setMenu(response.data);
    } catch (error) {
      console.error('Error fetching menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        price: parseFloat(formData.price) || 0
      };

      if (editingItem) {
        await menuApi.updateItem(Number(id), editingItem.id, data);
      } else {
        await menuApi.createItem(Number(id), data);
      }
      fetchMenu();
      closeModal();
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await menuApi.deleteItem(Number(id), itemId);
        fetchMenu();
        setExpandedItem(null);
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price?.toString() || '',
      category: item.category || '',
      is_vegetarian: item.is_vegetarian,
      is_vegan: item.is_vegan,
      is_gluten_free: item.is_gluten_free,
      spice_level: item.spice_level || 0
    });
    setShowItemModal(true);
  };

  const closeModal = () => {
    setShowItemModal(false);
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      is_vegetarian: false,
      is_vegan: false,
      is_gluten_free: false,
      spice_level: 0
    });
  };

  const toggleItemDetails = (itemId: number) => {
    setExpandedItem(expandedItem === itemId ? null : itemId);
  };

  // AI Functions
  const detectAllergens = async (item: MenuItem) => {
    const key = `allergens-${item.id}`;
    setAILoading(prev => ({ ...prev, [key]: true }));
    try {
      const response = await aiApi.detectAllergens(item.name, item.description || '', item.id);
      setAIResults(prev => ({ ...prev, [key]: response.data }));
      setShowAIModal({ type: 'allergens', item });
    } catch (error) {
      console.error('Error detecting allergens:', error);
    } finally {
      setAILoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const estimateCalories = async (item: MenuItem) => {
    const key = `calories-${item.id}`;
    setAILoading(prev => ({ ...prev, [key]: true }));
    try {
      const response = await aiApi.estimateCalories(item.name, item.description || '', item.id);
      setAIResults(prev => ({ ...prev, [key]: response.data }));
      setShowAIModal({ type: 'calories', item });
    } catch (error) {
      console.error('Error estimating calories:', error);
    } finally {
      setAILoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const translateItem = async (item: MenuItem, language: string = 'Spanish') => {
    const key = `translate-${item.id}`;
    setAILoading(prev => ({ ...prev, [key]: true }));
    try {
      const response = await aiApi.translate(item.name, item.description || '', language, item.id);
      setAIResults(prev => ({ ...prev, [key]: response.data }));
      setShowAIModal({ type: 'translation', item });
    } catch (error) {
      console.error('Error translating:', error);
    } finally {
      setAILoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Save AI results to database
  const saveAllergens = async (item: MenuItem, allergens: any[]) => {
    const key = `save-allergens-${item.id}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      for (const allergen of allergens) {
        await allergenApi.create({
          menu_item_id: item.id,
          name: allergen.name,
          severity: allergen.severity || 'moderate',
          description: allergen.description || ''
        });
      }
      setSaved(prev => ({ ...prev, [key]: true }));
      fetchMenu();
    } catch (error) {
      console.error('Error saving allergens:', error);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const saveNutrition = async (item: MenuItem, nutrition: any) => {
    const key = `save-nutrition-${item.id}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await nutritionApi.create({
        menu_item_id: item.id,
        calories: nutrition.calories || 0,
        protein: nutrition.protein || 0,
        carbohydrates: nutrition.carbohydrates || 0,
        fat: nutrition.fat || 0,
        fiber: nutrition.fiber || 0,
        sodium: nutrition.sodium || 0,
        sugar: nutrition.sugar || 0,
        serving_size: nutrition.serving_size || ''
      });
      setSaved(prev => ({ ...prev, [key]: true }));
      fetchMenu();
    } catch (error) {
      console.error('Error saving nutrition:', error);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const saveTranslation = async (item: MenuItem, translation: any) => {
    const key = `save-translation-${item.id}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await translationApi.create({
        menu_item_id: item.id,
        language_code: translation.language_code || 'es',
        language_name: translation.language_name || 'Spanish',
        translated_name: translation.translated_name,
        translated_description: translation.translated_description || ''
      });
      setSaved(prev => ({ ...prev, [key]: true }));
      fetchMenu();
    } catch (error) {
      console.error('Error saving translation:', error);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  // Bulk AI Analysis
  const bulkAnalyzeAll = async () => {
    if (!menu || menu.items.length === 0) return;

    setBulkLoading(true);
    setBulkComplete(false);
    setBulkResults([]);
    const total = menu.items.length;
    setBulkProgress({ current: 0, total, item: '' });

    let processedCount = 0;
    const results: any[] = [];

    for (const item of menu.items) {
      processedCount++;
      setBulkProgress({ current: processedCount, total, item: item.name });

      const itemResult: any = {
        item: item,
        allergens: null,
        nutrition: null,
        skippedAllergens: false,
        skippedNutrition: false,
        existingAllergens: item.allergens || [],
        existingNutrition: item.nutrition?.[0] || null
      };

      // Detect allergens (skip if already has data)
      if (!item.allergens || item.allergens.length === 0) {
        try {
          const response = await aiApi.detectAllergens(item.name, item.description || '', item.id);
          itemResult.allergens = response.data;
          if (response.data?.analysis?.allergens?.length > 0) {
            for (const allergen of response.data.analysis.allergens) {
              await allergenApi.create({
                menu_item_id: item.id,
                name: allergen.name,
                severity: allergen.severity || 'moderate',
                description: allergen.description || ''
              });
            }
          }
        } catch (e) {
          console.error(`Error analyzing allergens for ${item.name}:`, e);
          itemResult.allergens = { error: 'Failed to analyze' };
        }
      } else {
        itemResult.skippedAllergens = true;
      }

      // Estimate calories (skip if already has data)
      if (!item.nutrition || item.nutrition.length === 0) {
        try {
          const response = await aiApi.estimateCalories(item.name, item.description || '', item.id);
          itemResult.nutrition = response.data;
          if (response.data?.analysis?.nutrition) {
            const n = response.data.analysis.nutrition;
            await nutritionApi.create({
              menu_item_id: item.id,
              calories: n.calories || 0,
              protein: n.protein || 0,
              carbohydrates: n.carbohydrates || 0,
              fat: n.fat || 0,
              fiber: n.fiber || 0,
              sodium: n.sodium || 0,
              sugar: n.sugar || 0,
              serving_size: response.data.analysis.serving_size || ''
            });
          }
        } catch (e) {
          console.error(`Error estimating calories for ${item.name}:`, e);
          itemResult.nutrition = { error: 'Failed to analyze' };
        }
      } else {
        itemResult.skippedNutrition = true;
      }

      results.push(itemResult);
    }

    setBulkResults(results);
    setBulkLoading(false);
    setBulkComplete(true);
    setShowBulkResultsModal(true);
    fetchMenu();
  };

  // Group items by category
  const groupedItems = menu?.items.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>) || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600">Menu not found</p>
        <button onClick={() => navigate('/')} className="btn-primary mt-4">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Dashboard
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{menu.name}</h1>
            {menu.restaurant_name && (
              <p className="text-primary-600 font-medium mt-1">{menu.restaurant_name}</p>
            )}
            {menu.description && (
              <p className="text-gray-600 mt-2">{menu.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={bulkAnalyzeAll}
              disabled={bulkLoading}
              className="btn-secondary flex items-center gap-2"
              title="AI analyze all items missing data"
            >
              {bulkLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
              {bulkLoading ? 'Analyzing...' : 'AI Analyze All'}
            </button>
            <button
              onClick={() => setShowItemModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Item
            </button>
          </div>
        </div>

        {/* Bulk Analysis Progress */}
        {bulkLoading && bulkProgress.total > 0 && (
          <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-purple-900">
                    Analyzing: {bulkProgress.item}
                  </span>
                  <span className="text-sm text-purple-600">
                    {bulkProgress.current} / {bulkProgress.total}
                  </span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Analysis Complete */}
        {bulkComplete && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <Check className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-900">
              AI analysis complete! All items have been analyzed for allergens and nutrition.
            </span>
          </div>
        )}
      </div>

      {/* Menu Items by Category */}
      {Object.keys(groupedItems).length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm">
          <Utensils className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No items yet</h3>
          <p className="text-gray-600 mb-6">Add your first menu item</p>
          <button
            onClick={() => setShowItemModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Item
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-1 bg-primary-500 rounded"></span>
                {category}
                <span className="text-sm font-normal text-gray-500">({items.length})</span>
              </h2>

              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl shadow-sm overflow-hidden"
                  >
                    {/* Item Row - Clickable */}
                    <div
                      onClick={() => toggleItemDetails(item.id)}
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium text-gray-900">{item.name}</h3>
                            <div className="flex items-center gap-1">
                              {item.is_vegetarian && (
                                <span className="badge-green" title="Vegetarian">
                                  <Leaf className="h-3 w-3" />
                                </span>
                              )}
                              {item.is_vegan && (
                                <span className="badge-green" title="Vegan">V</span>
                              )}
                              {item.is_gluten_free && (
                                <span className="badge-yellow" title="Gluten Free">
                                  <Wheat className="h-3 w-3" />
                                </span>
                              )}
                              {item.spice_level > 0 && (
                                <span className="badge-red flex items-center gap-0.5" title={`Spice Level: ${item.spice_level}`}>
                                  <Flame className="h-3 w-3" />
                                  {item.spice_level}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.description && (
                            <p className="text-gray-600 text-sm mt-1 line-clamp-1">{item.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          {item.price && (
                            <span className="text-lg font-semibold text-primary-600">
                              ${parseFloat(item.price).toFixed(2)}
                            </span>
                          )}
                          {expandedItem === item.id ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedItem === item.id && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50">
                        {/* AI Quick Actions */}
                        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200">
                          <span className="text-sm text-gray-500 mr-2">AI Actions:</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); detectAllergens(item); }}
                            disabled={aiLoading[`allergens-${item.id}`]}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm hover:bg-yellow-200 transition-colors disabled:opacity-50"
                          >
                            {aiLoading[`allergens-${item.id}`] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            Detect Allergens
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); estimateCalories(item); }}
                            disabled={aiLoading[`calories-${item.id}`]}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-800 rounded-lg text-sm hover:bg-orange-200 transition-colors disabled:opacity-50"
                          >
                            {aiLoading[`calories-${item.id}`] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Flame className="h-3 w-3" />
                            )}
                            Estimate Calories
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); translateItem(item); }}
                            disabled={aiLoading[`translate-${item.id}`]}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm hover:bg-blue-200 transition-colors disabled:opacity-50"
                          >
                            {aiLoading[`translate-${item.id}`] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Languages className="h-3 w-3" />
                            )}
                            Translate
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          {/* Allergens */}
                          <div className="bg-white p-4 rounded-lg">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              Allergens
                            </h4>
                            {item.allergens && item.allergens.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {item.allergens.map((a: any, i: number) => (
                                  <span
                                    key={i}
                                    className={`text-xs px-2 py-1 rounded ${
                                      a.severity === 'high' ? 'bg-red-100 text-red-800' :
                                      a.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {a.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No allergens listed</p>
                            )}
                          </div>

                          {/* Nutrition */}
                          <div className="bg-white p-4 rounded-lg">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                              <Flame className="h-4 w-4 text-orange-500" />
                              Nutrition
                            </h4>
                            {item.nutrition && item.nutrition.length > 0 ? (
                              <div className="text-sm space-y-1">
                                <p><span className="text-gray-600">Calories:</span> <span className="font-medium">{item.nutrition[0].calories}</span></p>
                                <p><span className="text-gray-600">Protein:</span> <span className="font-medium">{item.nutrition[0].protein}g</span></p>
                                <p><span className="text-gray-600">Carbs:</span> <span className="font-medium">{item.nutrition[0].carbohydrates}g</span></p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No nutrition data</p>
                            )}
                          </div>

                          {/* Translations */}
                          <div className="bg-white p-4 rounded-lg">
                            <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                              <Languages className="h-4 w-4 text-blue-500" />
                              Translations
                            </h4>
                            {item.translations && item.translations.length > 0 ? (
                              <div className="text-sm space-y-1">
                                {item.translations.slice(0, 3).map((t: any, i: number) => (
                                  <p key={i}>
                                    <span className="text-gray-600">{t.language_name}:</span>{' '}
                                    <span className="font-medium">{t.translated_name}</span>
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No translations</p>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => openEditModal(item)}
                            className="btn-secondary flex items-center gap-2 text-sm py-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="btn-danger flex items-center gap-2 text-sm py-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-xl font-semibold">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Margherita Pizza"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Main Course"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows={3}
                    placeholder="Describe the dish..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Spice Level (0-4)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={formData.spice_level}
                    onChange={(e) => setFormData({ ...formData, spice_level: parseInt(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_vegetarian}
                    onChange={(e) => setFormData({ ...formData, is_vegetarian: e.target.checked })}
                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Vegetarian</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_vegan}
                    onChange={(e) => setFormData({ ...formData, is_vegan: e.target.checked })}
                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Vegan</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_gluten_free}
                    onChange={(e) => setFormData({ ...formData, is_gluten_free: e.target.checked })}
                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Gluten Free</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Result Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                AI Analysis: {showAIModal.item.name}
              </h2>
              <button
                onClick={() => setShowAIModal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {showAIModal.type === 'allergens' && aiResults[`allergens-${showAIModal.item.id}`] && (
                <>
                  <AIResultDisplay
                    title="Detected Allergens"
                    result={aiResults[`allergens-${showAIModal.item.id}`]}
                    type="allergens"
                  />
                  {aiResults[`allergens-${showAIModal.item.id}`]?.analysis?.allergens?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => saveAllergens(showAIModal.item, aiResults[`allergens-${showAIModal.item.id}`].analysis.allergens)}
                        disabled={saving[`save-allergens-${showAIModal.item.id}`] || saved[`save-allergens-${showAIModal.item.id}`]}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                      >
                        {saved[`save-allergens-${showAIModal.item.id}`] ? (
                          <>
                            <Check className="h-5 w-5" />
                            Saved!
                          </>
                        ) : saving[`save-allergens-${showAIModal.item.id}`] ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-5 w-5" />
                            Save Allergens to Database
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}

              {showAIModal.type === 'calories' && aiResults[`calories-${showAIModal.item.id}`] && (
                <>
                  <AIResultDisplay
                    title="Nutrition Estimate"
                    result={aiResults[`calories-${showAIModal.item.id}`]}
                    type="calories"
                  />
                  {aiResults[`calories-${showAIModal.item.id}`]?.analysis?.nutrition && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => saveNutrition(showAIModal.item, {
                          ...aiResults[`calories-${showAIModal.item.id}`].analysis.nutrition,
                          serving_size: aiResults[`calories-${showAIModal.item.id}`].analysis.serving_size
                        })}
                        disabled={saving[`save-nutrition-${showAIModal.item.id}`] || saved[`save-nutrition-${showAIModal.item.id}`]}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                      >
                        {saved[`save-nutrition-${showAIModal.item.id}`] ? (
                          <>
                            <Check className="h-5 w-5" />
                            Saved!
                          </>
                        ) : saving[`save-nutrition-${showAIModal.item.id}`] ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-5 w-5" />
                            Save Nutrition to Database
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}

              {showAIModal.type === 'translation' && aiResults[`translate-${showAIModal.item.id}`] && (
                <>
                  <AIResultDisplay
                    title="Translation"
                    result={aiResults[`translate-${showAIModal.item.id}`]}
                    type="translation"
                  />
                  {aiResults[`translate-${showAIModal.item.id}`]?.analysis?.translation && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => saveTranslation(showAIModal.item, aiResults[`translate-${showAIModal.item.id}`].analysis.translation)}
                        disabled={saving[`save-translation-${showAIModal.item.id}`] || saved[`save-translation-${showAIModal.item.id}`]}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                      >
                        {saved[`save-translation-${showAIModal.item.id}`] ? (
                          <>
                            <Check className="h-5 w-5" />
                            Saved!
                          </>
                        ) : saving[`save-translation-${showAIModal.item.id}`] ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-5 w-5" />
                            Save Translation to Database
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Analysis Results Modal */}
      {showBulkResultsModal && bulkResults.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="h-6 w-6" />
                  AI Analysis Complete!
                </h2>
                <p className="text-purple-100 text-sm mt-1">
                  Analyzed {bulkResults.length} items • All results saved to database
                </p>
              </div>
              <button
                onClick={() => setShowBulkResultsModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white text-center">
                  <div className="text-3xl font-bold">{bulkResults.length}</div>
                  <div className="text-sm opacity-90">Items Analyzed</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-4 text-white text-center">
                  <div className="text-3xl font-bold">
                    {bulkResults.reduce((acc, r) => acc + (r.allergens?.analysis?.allergens?.length || 0), 0)}
                  </div>
                  <div className="text-sm opacity-90">Allergens Found</div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-4 text-white text-center">
                  <div className="text-3xl font-bold">
                    {bulkResults.filter(r => r.nutrition?.analysis?.nutrition).length}
                  </div>
                  <div className="text-sm opacity-90">Nutrition Estimated</div>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-4 text-white text-center">
                  <div className="text-3xl font-bold">
                    {bulkResults.reduce((acc, r) => acc + (r.allergens?.tokensUsed || 0) + (r.nutrition?.tokensUsed || 0), 0)}
                  </div>
                  <div className="text-sm opacity-90">Tokens Used</div>
                </div>
              </div>

              {/* Individual Results */}
              <div className="space-y-4">
                {bulkResults.map((result, index) => (
                  <div key={index} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                    {/* Item Header */}
                    <div className="bg-white px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{result.item.name}</h3>
                          {result.item.description && (
                            <p className="text-sm text-gray-500 line-clamp-1">{result.item.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {result.skippedAllergens && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">Allergens: Existing</span>
                          )}
                          {result.skippedNutrition && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">Nutrition: Existing</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Allergens Results */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          Allergens
                          {result.skippedAllergens && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Existing Data</span>
                          )}
                        </h4>
                        {result.skippedAllergens && result.existingAllergens?.length > 0 ? (
                          <div className="space-y-2">
                            {result.existingAllergens.map((a: any, i: number) => (
                              <div key={i} className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">{a.name}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  a.severity === 'high' ? 'bg-red-100 text-red-700' :
                                  a.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {a.severity}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : result.allergens?.error ? (
                          <p className="text-sm text-red-500">{result.allergens.error}</p>
                        ) : result.allergens?.analysis?.allergens?.length > 0 ? (
                          <div className="space-y-2">
                            {result.allergens.analysis.allergens.map((a: any, i: number) => (
                              <div key={i} className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">{a.name}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  a.severity === 'high' ? 'bg-red-100 text-red-700' :
                                  a.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {a.severity}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-green-600 flex items-center gap-1">
                            <Check className="h-4 w-4" />
                            No allergens detected
                          </p>
                        )}
                      </div>

                      {/* Nutrition Results */}
                      <div className="bg-white rounded-xl p-4 border border-gray-100">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2 mb-3">
                          <Flame className="h-4 w-4 text-orange-500" />
                          Nutrition
                          {result.skippedNutrition && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Existing Data</span>
                          )}
                        </h4>
                        {result.skippedNutrition && result.existingNutrition ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Calories</span>
                              <span className="text-lg font-bold text-orange-600">
                                {result.existingNutrition.calories}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-blue-50 rounded-lg p-2">
                                <div className="text-sm font-bold text-blue-600">
                                  {result.existingNutrition.protein}g
                                </div>
                                <div className="text-xs text-blue-500">Protein</div>
                              </div>
                              <div className="bg-green-50 rounded-lg p-2">
                                <div className="text-sm font-bold text-green-600">
                                  {result.existingNutrition.carbohydrates}g
                                </div>
                                <div className="text-xs text-green-500">Carbs</div>
                              </div>
                              <div className="bg-yellow-50 rounded-lg p-2">
                                <div className="text-sm font-bold text-yellow-600">
                                  {result.existingNutrition.fat}g
                                </div>
                                <div className="text-xs text-yellow-500">Fat</div>
                              </div>
                            </div>
                          </div>
                        ) : result.nutrition?.error ? (
                          <p className="text-sm text-red-500">{result.nutrition.error}</p>
                        ) : result.nutrition?.analysis?.nutrition ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Calories</span>
                              <span className="text-lg font-bold text-orange-600">
                                {result.nutrition.analysis.nutrition.calories}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-blue-50 rounded-lg p-2">
                                <div className="text-sm font-bold text-blue-600">
                                  {result.nutrition.analysis.nutrition.protein}g
                                </div>
                                <div className="text-xs text-blue-500">Protein</div>
                              </div>
                              <div className="bg-green-50 rounded-lg p-2">
                                <div className="text-sm font-bold text-green-600">
                                  {result.nutrition.analysis.nutrition.carbohydrates}g
                                </div>
                                <div className="text-xs text-green-500">Carbs</div>
                              </div>
                              <div className="bg-yellow-50 rounded-lg p-2">
                                <div className="text-sm font-bold text-yellow-600">
                                  {result.nutrition.analysis.nutrition.fat}g
                                </div>
                                <div className="text-xs text-yellow-500">Fat</div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No nutrition data</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowBulkResultsModal(false)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Check className="h-5 w-5" />
                Done - View Updated Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
