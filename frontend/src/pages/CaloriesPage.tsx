import { useState, useEffect } from 'react';
import { menuApi, nutritionApi, aiApi } from '../services/api';
import {
  Flame,
  Plus,
  X,
  Edit,
  Trash2,
  Brain,
  Loader2,
  Activity,
  Save,
  Check,
  Sparkles
} from 'lucide-react';
import AIResultDisplay from '../components/AIResultDisplay';
import { useToast } from '../context/ToastContext';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import SortControls from '../components/SortControls';
import BulkActionBar from '../components/BulkActionBar';
import ConfirmDialog from '../components/ConfirmDialog';
import DetailDrawer from '../components/DetailDrawer';
import { SkeletonTable } from '../components/Skeleton';
import NutritionDetail from '../components/details/NutritionDetail';

interface Menu {
  id: number;
  name: string;
  restaurant_name: string;
}

interface Nutrition {
  id: number;
  menu_item_id: number;
  item_name: string;
  category: string;
  price: string;
  calories: number;
  protein: string;
  carbohydrates: string;
  fat: string;
  fiber: string;
  sodium: string;
  sugar: string;
  serving_size: string;
}

export default function CaloriesPage() {
  const { addToast } = useToast();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<number | null>(null);
  const [nutrition, setNutrition] = useState<Nutrition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNutrition, setEditingNutrition] = useState<Nutrition | null>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    menu_item_id: '',
    calories: '',
    protein: '',
    carbohydrates: '',
    fat: '',
    fiber: '',
    sodium: '',
    sugar: '',
    serving_size: ''
  });
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiLoading, setAILoading] = useState(false);
  const [aiResult, setAIResult] = useState<any>(null);
  const [aiInput, setAIInput] = useState({ itemName: '', description: '', menuItemId: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Sort state
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Confirm dialog state
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id?: number }>({ open: false });

  // Detail drawer state
  const [drawerItem, setDrawerItem] = useState<Nutrition | null>(null);

  useEffect(() => {
    fetchMenus();
  }, []);

  useEffect(() => {
    if (selectedMenu) {
      fetchNutrition();
      fetchMenuItems();
    }
  }, [selectedMenu, page, limit, searchTerm, sortBy, sortOrder]);

  const fetchMenus = async () => {
    try {
      const response = await menuApi.getAll();
      setMenus(response.data);
      if (response.data.length > 0) {
        setSelectedMenu(response.data[0].id);
      }
    } catch (error) {
      addToast('Error fetching menus', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchNutrition = async () => {
    if (!selectedMenu) return;
    setLoading(true);
    try {
      const response = await nutritionApi.getByMenu(selectedMenu, {
        page, limit, search: searchTerm, sortBy, sortOrder
      });
      if (response.data?.data) {
        setNutrition(response.data.data);
        setTotal(response.data.pagination?.total || response.data.data.length);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        setNutrition(Array.isArray(response.data) ? response.data : []);
        setTotal(Array.isArray(response.data) ? response.data.length : 0);
        setTotalPages(1);
      }
    } catch (error) {
      addToast('Error fetching nutrition data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuItems = async () => {
    if (!selectedMenu) return;
    try {
      const response = await menuApi.getById(selectedMenu);
      setMenuItems(response.data.items || []);
    } catch (error) {
      addToast('Error fetching menu items', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        menu_item_id: parseInt(formData.menu_item_id),
        calories: parseInt(formData.calories) || 0,
        protein: parseFloat(formData.protein) || 0,
        carbohydrates: parseFloat(formData.carbohydrates) || 0,
        fat: parseFloat(formData.fat) || 0,
        fiber: parseFloat(formData.fiber) || 0,
        sodium: parseFloat(formData.sodium) || 0,
        sugar: parseFloat(formData.sugar) || 0,
        serving_size: formData.serving_size
      };

      if (editingNutrition) {
        await nutritionApi.update(editingNutrition.id, data);
        addToast('Nutrition data updated successfully', 'success');
      } else {
        await nutritionApi.create(data);
        addToast('Nutrition data added successfully', 'success');
      }
      fetchNutrition();
      closeModal();
    } catch (error) {
      addToast('Error saving nutrition data', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await nutritionApi.delete(id);
      addToast('Nutrition data deleted successfully', 'success');
      setDrawerItem(null);
      fetchNutrition();
    } catch (error) {
      addToast('Error deleting nutrition data', 'error');
    }
    setConfirmDelete({ open: false });
  };

  const handleBulkDelete = async () => {
    try {
      await nutritionApi.bulkDelete(Array.from(selectedIds));
      addToast(`${selectedIds.size} nutrition entries deleted`, 'success');
      setSelectedIds(new Set());
      fetchNutrition();
    } catch (error) {
      addToast('Error deleting nutrition data', 'error');
    }
    setConfirmDelete({ open: false });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEditModal = (item: Nutrition) => {
    setEditingNutrition(item);
    setFormData({
      menu_item_id: item.menu_item_id.toString(),
      calories: item.calories?.toString() || '',
      protein: item.protein?.toString() || '',
      carbohydrates: item.carbohydrates?.toString() || '',
      fat: item.fat?.toString() || '',
      fiber: item.fiber?.toString() || '',
      sodium: item.sodium?.toString() || '',
      sugar: item.sugar?.toString() || '',
      serving_size: item.serving_size || ''
    });
    setShowModal(true);
    setDrawerItem(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingNutrition(null);
    setFormData({
      menu_item_id: '',
      calories: '',
      protein: '',
      carbohydrates: '',
      fat: '',
      fiber: '',
      sodium: '',
      sugar: '',
      serving_size: ''
    });
  };

  const handleAIEstimate = async () => {
    if (!aiInput.itemName) return;
    setAILoading(true);
    setSaved(false);
    try {
      const response = await aiApi.estimateCalories(
        aiInput.itemName,
        aiInput.description,
        aiInput.menuItemId ? parseInt(aiInput.menuItemId) : undefined
      );
      setAIResult(response.data);
      addToast('AI estimation complete', 'success');
    } catch (error) {
      addToast('Error estimating calories', 'error');
    } finally {
      setAILoading(false);
    }
  };

  const saveAIResults = async () => {
    if (!aiResult?.analysis?.nutrition || !aiInput.menuItemId) return;

    setSaving(true);
    try {
      const n = aiResult.analysis.nutrition;
      await nutritionApi.create({
        menu_item_id: parseInt(aiInput.menuItemId),
        calories: n.calories || 0,
        protein: n.protein || 0,
        carbohydrates: n.carbohydrates || 0,
        fat: n.fat || 0,
        fiber: n.fiber || 0,
        sodium: n.sodium || 0,
        sugar: n.sugar || 0,
        serving_size: aiResult.analysis.serving_size || ''
      });
      setSaved(true);
      addToast('AI results saved to database', 'success');
      fetchNutrition();
    } catch (error) {
      addToast('Error saving nutrition data', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectMenuItem = (itemId: string) => {
    const item = menuItems.find(i => i.id.toString() === itemId);
    if (item) {
      setAIInput({
        itemName: item.name,
        description: item.description || '',
        menuItemId: itemId
      });
    }
  };

  // Calculate totals from current page data
  const totalCalories = nutrition.reduce((sum, n) => sum + (n.calories || 0), 0);
  const avgCalories = nutrition.length > 0 ? Math.round(totalCalories / nutrition.length) : 0;

  const sortOptions = [
    { label: 'Date Created', value: 'created_at' },
    { label: 'Item Name', value: 'item_name' },
    { label: 'Calories', value: 'calories' },
    { label: 'Protein', value: 'protein' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Flame className="h-7 w-7 text-orange-500" />
            Calorie & Nutrition
          </h1>
          <p className="text-gray-600 mt-1">Track nutritional information for menu items</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setShowAIModal(true); setSaved(false); setAIResult(null); }}
            className="btn-secondary flex items-center gap-2"
          >
            <Brain className="h-5 w-5" />
            AI Estimate
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Nutrition
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Average Calories</p>
              <p className="text-2xl font-bold">{avgCalories}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Items Tracked</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Total Calories (page)</p>
              <p className="text-2xl font-bold">{totalCalories.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar
          value={searchTerm}
          onChange={(v) => { setSearchTerm(v); setPage(1); }}
          placeholder="Search items..."
        />
        <SortControls
          options={sortOptions}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(s, o) => { setSortBy(s); setSortOrder(o); }}
        />
        <select
          value={selectedMenu || ''}
          onChange={(e) => { setSelectedMenu(Number(e.target.value)); setPage(1); }}
          className="input-field w-full sm:w-64"
        >
          {menus.map(menu => (
            <option key={menu.id} value={menu.id}>
              {menu.name} - {menu.restaurant_name}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onDelete={() => setConfirmDelete({ open: true })}
        onClear={() => setSelectedIds(new Set())}
        entityName="nutrition entries"
      />

      {/* Nutrition Table */}
      {loading ? (
        <SkeletonTable rows={5} />
      ) : nutrition.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm">
          <Flame className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No nutrition data found</h3>
          <p className="text-gray-600">Add nutritional information to menu items</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === nutrition.length && nutrition.length > 0}
                      onChange={() => {
                        if (selectedIds.size === nutrition.length) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(nutrition.map(n => n.id)));
                        }
                      }}
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Calories</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Protein</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Carbs</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Fat</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Serving</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {nutrition.map(item => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setDrawerItem(item)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.item_name}</p>
                        <p className="text-xs text-gray-500">{item.category}</p>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className="font-semibold text-orange-600">{item.calories}</span>
                    </td>
                    <td className="text-center px-4 py-3 text-sm text-gray-600">{item.protein}g</td>
                    <td className="text-center px-4 py-3 text-sm text-gray-600">{item.carbohydrates}g</td>
                    <td className="text-center px-4 py-3 text-sm text-gray-600">{item.fat}g</td>
                    <td className="text-center px-4 py-3 text-xs text-gray-500">{item.serving_size}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ open: true, id: item.id })}
                          className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!drawerItem}
        title="Nutrition Details"
        onClose={() => setDrawerItem(null)}
        onEdit={() => drawerItem && openEditModal(drawerItem)}
        onDelete={() => drawerItem && setConfirmDelete({ open: true, id: drawerItem.id })}
      >
        {drawerItem && <NutritionDetail nutrition={drawerItem} />}
      </DetailDrawer>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete.open}
        title={confirmDelete.id ? 'Delete Nutrition Data' : 'Delete Selected Entries'}
        message={confirmDelete.id
          ? 'Are you sure you want to delete this nutrition data? This action cannot be undone.'
          : `Are you sure you want to delete ${selectedIds.size} selected entries? This action cannot be undone.`
        }
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => confirmDelete.id ? handleDelete(confirmDelete.id) : handleBulkDelete()}
        onCancel={() => setConfirmDelete({ open: false })}
      />

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-xl font-semibold">
                {editingNutrition ? 'Edit Nutrition' : 'Add Nutrition Data'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Menu Item *</label>
                <select
                  value={formData.menu_item_id}
                  onChange={(e) => setFormData({ ...formData, menu_item_id: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select item...</option>
                  {menuItems.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calories</label>
                  <input type="number" value={formData.calories} onChange={(e) => setFormData({ ...formData, calories: e.target.value })} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Protein (g)</label>
                  <input type="number" step="0.1" value={formData.protein} onChange={(e) => setFormData({ ...formData, protein: e.target.value })} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
                  <input type="number" step="0.1" value={formData.carbohydrates} onChange={(e) => setFormData({ ...formData, carbohydrates: e.target.value })} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fat (g)</label>
                  <input type="number" step="0.1" value={formData.fat} onChange={(e) => setFormData({ ...formData, fat: e.target.value })} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fiber (g)</label>
                  <input type="number" step="0.1" value={formData.fiber} onChange={(e) => setFormData({ ...formData, fiber: e.target.value })} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sugar (g)</label>
                  <input type="number" step="0.1" value={formData.sugar} onChange={(e) => setFormData({ ...formData, sugar: e.target.value })} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sodium (mg)</label>
                  <input type="number" step="0.1" value={formData.sodium} onChange={(e) => setFormData({ ...formData, sodium: e.target.value })} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serving Size</label>
                  <input type="text" value={formData.serving_size} onChange={(e) => setFormData({ ...formData, serving_size: e.target.value })} className="input-field" placeholder="e.g., 1 plate (350g)" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editingNutrition ? 'Save Changes' : 'Add Nutrition'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Estimation Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                AI Calorie Estimation
              </h2>
              <button onClick={() => { setShowAIModal(false); setAIResult(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quick Select from Menu</label>
                <select value={aiInput.menuItemId} onChange={(e) => selectMenuItem(e.target.value)} className="input-field">
                  <option value="">Select a menu item...</option>
                  {menuItems.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="text-sm text-gray-500">or enter manually</span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setAIInput({
                    itemName: 'Grilled Salmon',
                    description: 'Atlantic salmon fillet grilled with lemon butter sauce, served with roasted seasonal vegetables and wild rice pilaf. Garnished with fresh dill and capers.',
                    menuItemId: aiInput.menuItemId
                  })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm"
                >
                  <Sparkles className="h-4 w-4" />
                  Load Sample Data
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Food Item Name *</label>
                <input type="text" value={aiInput.itemName} onChange={(e) => setAIInput({ ...aiInput, itemName: e.target.value })} className="input-field" placeholder="e.g., Margherita Pizza" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={aiInput.description} onChange={(e) => setAIInput({ ...aiInput, description: e.target.value })} className="input-field" rows={2} placeholder="Describe the dish size, ingredients..." />
              </div>

              <button
                onClick={handleAIEstimate}
                disabled={aiLoading || !aiInput.itemName}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {aiLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Brain className="h-5 w-5" />}
                {aiLoading ? 'Estimating...' : 'Estimate Calories'}
              </button>

              {aiResult && (
                <>
                  <AIResultDisplay title="Nutrition Estimate" result={aiResult} type="calories" />
                  {aiResult.analysis?.nutrition && aiInput.menuItemId && (
                    <div className="pt-4 border-t border-gray-200">
                      <button onClick={saveAIResults} disabled={saving || saved} className="btn-primary w-full flex items-center justify-center gap-2">
                        {saved ? (<><Check className="h-5 w-5" />Saved to Database!</>) : saving ? (<><Loader2 className="h-5 w-5 animate-spin" />Saving...</>) : (<><Save className="h-5 w-5" />Save Nutrition to Database</>)}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
