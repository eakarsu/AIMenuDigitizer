import { useState, useEffect } from 'react';
import { menuApi, allergenApi, aiApi } from '../services/api';
import {
  AlertTriangle,
  Plus,
  X,
  Edit,
  Trash2,
  Brain,
  Loader2,
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
import AllergenDetail from '../components/details/AllergenDetail';

interface Menu {
  id: number;
  name: string;
  restaurant_name: string;
}

interface Allergen {
  id: number;
  menu_item_id: number;
  name: string;
  severity: string;
  description: string;
  item_name: string;
  category: string;
  created_at?: string;
}

export default function AllergensPage() {
  const { addToast } = useToast();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<number | null>(null);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAllergen, setEditingAllergen] = useState<Allergen | null>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    menu_item_id: '',
    name: '',
    severity: 'moderate',
    description: ''
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
  const [drawerItem, setDrawerItem] = useState<Allergen | null>(null);

  useEffect(() => {
    fetchMenus();
  }, []);

  useEffect(() => {
    if (selectedMenu) {
      fetchAllergens();
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

  const fetchAllergens = async () => {
    if (!selectedMenu) return;
    setLoading(true);
    try {
      const response = await allergenApi.getByMenu(selectedMenu, {
        page, limit, search: searchTerm, sortBy, sortOrder
      });
      // Handle both paginated and non-paginated response formats
      if (response.data?.data) {
        setAllergens(response.data.data);
        setTotal(response.data.pagination?.total || response.data.data.length);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        setAllergens(Array.isArray(response.data) ? response.data : []);
        setTotal(Array.isArray(response.data) ? response.data.length : 0);
        setTotalPages(1);
      }
    } catch (error) {
      addToast('Error fetching allergens', 'error');
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
      if (editingAllergen) {
        await allergenApi.update(editingAllergen.id, formData);
        addToast('Allergen updated successfully', 'success');
      } else {
        await allergenApi.create({
          ...formData,
          menu_item_id: parseInt(formData.menu_item_id)
        });
        addToast('Allergen added successfully', 'success');
      }
      fetchAllergens();
      closeModal();
    } catch (error) {
      addToast('Error saving allergen', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await allergenApi.delete(id);
      addToast('Allergen deleted successfully', 'success');
      setDrawerItem(null);
      fetchAllergens();
    } catch (error) {
      addToast('Error deleting allergen', 'error');
    }
    setConfirmDelete({ open: false });
  };

  const handleBulkDelete = async () => {
    try {
      await allergenApi.bulkDelete(Array.from(selectedIds));
      addToast(`${selectedIds.size} allergens deleted`, 'success');
      setSelectedIds(new Set());
      fetchAllergens();
    } catch (error) {
      addToast('Error deleting allergens', 'error');
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

  const openEditModal = (allergen: Allergen) => {
    setEditingAllergen(allergen);
    setFormData({
      menu_item_id: allergen.menu_item_id.toString(),
      name: allergen.name,
      severity: allergen.severity,
      description: allergen.description || ''
    });
    setShowModal(true);
    setDrawerItem(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAllergen(null);
    setFormData({
      menu_item_id: '',
      name: '',
      severity: 'moderate',
      description: ''
    });
  };

  const handleAIDetect = async () => {
    if (!aiInput.itemName) return;
    setAILoading(true);
    setSaved(false);
    try {
      const response = await aiApi.detectAllergens(
        aiInput.itemName,
        aiInput.description,
        aiInput.menuItemId ? parseInt(aiInput.menuItemId) : undefined
      );
      setAIResult(response.data);
      addToast('AI detection complete', 'success');
    } catch (error) {
      addToast('Error detecting allergens', 'error');
    } finally {
      setAILoading(false);
    }
  };

  const saveAIResults = async () => {
    if (!aiResult?.analysis?.allergens || !aiInput.menuItemId) return;

    setSaving(true);
    try {
      for (const allergen of aiResult.analysis.allergens) {
        await allergenApi.create({
          menu_item_id: parseInt(aiInput.menuItemId),
          name: allergen.name,
          severity: allergen.severity || 'moderate',
          description: allergen.description || ''
        });
      }
      setSaved(true);
      addToast('AI results saved to database', 'success');
      fetchAllergens();
    } catch (error) {
      addToast('Error saving allergens', 'error');
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

  const sortOptions = [
    { label: 'Date Created', value: 'created_at' },
    { label: 'Allergen Name', value: 'name' },
    { label: 'Severity', value: 'severity' },
    { label: 'Item Name', value: 'item_name' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-yellow-500" />
            Allergen Management
          </h1>
          <p className="text-gray-600 mt-1">Track and manage allergens for menu items</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setShowAIModal(true); setSaved(false); setAIResult(null); }}
            className="btn-secondary flex items-center gap-2"
          >
            <Brain className="h-5 w-5" />
            AI Detect
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Allergen
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar
          value={searchTerm}
          onChange={(v) => { setSearchTerm(v); setPage(1); }}
          placeholder="Search allergens..."
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
        entityName="allergens"
      />

      {/* Allergens List */}
      {loading ? (
        <SkeletonTable rows={5} />
      ) : allergens.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm">
          <AlertTriangle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No allergens found</h3>
          <p className="text-gray-600">Add allergen information to menu items</p>
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
                      checked={selectedIds.size === allergens.length && allergens.length > 0}
                      onChange={() => {
                        if (selectedIds.size === allergens.length) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(allergens.map(a => a.id)));
                        }
                      }}
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Allergen</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Severity</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Description</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allergens.map(allergen => (
                  <tr
                    key={allergen.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setDrawerItem(allergen)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(allergen.id)}
                        onChange={() => toggleSelect(allergen.id)}
                        className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{allergen.item_name}</p>
                        <p className="text-xs text-gray-500">{allergen.category}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{allergen.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        allergen.severity === 'high' ? 'bg-red-100 text-red-800' :
                        allergen.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {allergen.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {allergen.description}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(allergen)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ open: true, id: allergen.id })}
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
        title="Allergen Details"
        onClose={() => setDrawerItem(null)}
        onEdit={() => drawerItem && openEditModal(drawerItem)}
        onDelete={() => drawerItem && setConfirmDelete({ open: true, id: drawerItem.id })}
      >
        {drawerItem && <AllergenDetail allergen={drawerItem} />}
      </DetailDrawer>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete.open}
        title={confirmDelete.id ? 'Delete Allergen' : 'Delete Selected Allergens'}
        message={confirmDelete.id
          ? 'Are you sure you want to delete this allergen? This action cannot be undone.'
          : `Are you sure you want to delete ${selectedIds.size} selected allergens? This action cannot be undone.`
        }
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => confirmDelete.id ? handleDelete(confirmDelete.id) : handleBulkDelete()}
        onCancel={() => setConfirmDelete({ open: false })}
      />

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold">
                {editingAllergen ? 'Edit Allergen' : 'Add Allergen'}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allergen Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Gluten, Dairy, Peanuts"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="input-field"
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="Additional details..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingAllergen ? 'Save Changes' : 'Add Allergen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Detection Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                AI Allergen Detection
              </h2>
              <button onClick={() => { setShowAIModal(false); setAIResult(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quick Select from Menu
                </label>
                <select
                  value={aiInput.menuItemId}
                  onChange={(e) => selectMenuItem(e.target.value)}
                  className="input-field"
                >
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
                    itemName: 'Spaghetti Carbonara',
                    description: 'Classic Italian pasta with eggs, pecorino romano cheese, guanciale, black pepper, and spaghetti noodles. Topped with parmesan and served with garlic bread.',
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
                <input
                  type="text"
                  value={aiInput.itemName}
                  onChange={(e) => setAIInput({ ...aiInput, itemName: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Spaghetti Carbonara"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={aiInput.description}
                  onChange={(e) => setAIInput({ ...aiInput, description: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="Describe the dish and its ingredients..."
                />
              </div>

              <button
                onClick={handleAIDetect}
                disabled={aiLoading || !aiInput.itemName}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Brain className="h-5 w-5" />
                )}
                {aiLoading ? 'Analyzing...' : 'Detect Allergens'}
              </button>

              {aiResult && (
                <>
                  <AIResultDisplay
                    title="Detected Allergens"
                    result={aiResult}
                    type="allergens"
                  />

                  {aiResult.analysis?.allergens?.length > 0 && aiInput.menuItemId && (
                    <div className="pt-4 border-t border-gray-200">
                      <button
                        onClick={saveAIResults}
                        disabled={saving || saved}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                      >
                        {saved ? (
                          <>
                            <Check className="h-5 w-5" />
                            Saved to Database!
                          </>
                        ) : saving ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-5 w-5" />
                            Save All Allergens to Database
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
    </div>
  );
}
