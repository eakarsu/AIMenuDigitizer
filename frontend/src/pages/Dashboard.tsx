import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { menuApi, exportApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  Plus, Menu as MenuIcon, Utensils, Calendar, Trash2, Edit, X, ChevronRight,
  AlertTriangle, Flame, Globe2, DollarSign, Sparkles, Heart, Brain, Download, FileText
} from 'lucide-react';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import SortControls from '../components/SortControls';
import BulkActionBar from '../components/BulkActionBar';
import ConfirmDialog from '../components/ConfirmDialog';
import { SkeletonCard } from '../components/Skeleton';

interface Menu {
  id: number;
  name: string;
  restaurant_name: string;
  description: string;
  item_count: string;
  created_at: string;
}

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  path: string;
}

export default function Dashboard() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [formData, setFormData] = useState({ name: '', restaurant_name: '', description: '' });
  const [activeTab, setActiveTab] = useState<'features' | 'menus'>('features');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id?: number }>({ open: false });

  const navigate = useNavigate();
  const { addToast } = useToast();

  const featureCards: FeatureCard[] = [
    { id: 'allergens', title: 'AI Allergen Detector', description: 'Detect and analyze food allergens with AI-powered precision', icon: <AlertTriangle className="h-8 w-8" />, gradient: 'from-red-500 to-orange-500', path: '/allergens' },
    { id: 'nutrition', title: 'AI Nutrition Analyzer', description: 'Healthcare-focused nutrition analysis for dietary needs', icon: <Heart className="h-8 w-8" />, gradient: 'from-pink-500 to-rose-500', path: '/nutrition-healthcare' },
    { id: 'calories', title: 'AI Calorie Estimator', description: 'Estimate calories and macronutrients for any dish', icon: <Flame className="h-8 w-8" />, gradient: 'from-orange-500 to-amber-500', path: '/calories' },
    { id: 'price', title: 'AI Price Optimizer', description: 'Optimize menu prices for maximum profitability', icon: <DollarSign className="h-8 w-8" />, gradient: 'from-green-500 to-emerald-500', path: '/price-optimizer' },
    { id: 'recommend', title: 'AI Dish Recommender', description: 'Personalized dish recommendations based on preferences', icon: <Sparkles className="h-8 w-8" />, gradient: 'from-purple-500 to-pink-500', path: '/dish-recommender' },
    { id: 'translations', title: 'AI Translation Engine', description: 'Translate menus into multiple languages seamlessly', icon: <Globe2 className="h-8 w-8" />, gradient: 'from-blue-500 to-indigo-500', path: '/translations' },
  ];

  useEffect(() => { fetchMenus(); }, [page, limit, search, sortBy, sortOrder]);

  const fetchMenus = async () => {
    try {
      const response = await menuApi.getAll({ page, limit, search, sortBy, sortOrder });
      setMenus(response.data.data || response.data);
      if (response.data.pagination) {
        setTotal(response.data.pagination.total);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      addToast('Failed to fetch menus', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMenu) {
        await menuApi.update(editingMenu.id, formData);
        addToast('Menu updated successfully', 'success');
      } else {
        await menuApi.create(formData);
        addToast('Menu created successfully', 'success');
      }
      fetchMenus();
      closeModal();
    } catch (error) {
      addToast('Failed to save menu', 'error');
    }
  };

  const handleDelete = async (id?: number) => {
    const deleteId = id || confirmDelete.id;
    if (!deleteId) return;
    try {
      await menuApi.delete(deleteId);
      addToast('Menu deleted successfully', 'success');
      fetchMenus();
    } catch (error) {
      addToast('Failed to delete menu', 'error');
    }
    setConfirmDelete({ open: false });
  };

  const handleBulkDelete = async () => {
    try {
      await menuApi.bulkDelete(Array.from(selectedIds));
      addToast(`${selectedIds.size} menus deleted`, 'success');
      setSelectedIds(new Set());
      fetchMenus();
    } catch (error) {
      addToast('Failed to delete menus', 'error');
    }
    setConfirmDelete({ open: false });
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const response = format === 'csv' ? await exportApi.csv('menus') : await exportApi.pdf('menus');
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `menus.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      addToast(`Exported as ${format.toUpperCase()}`, 'success');
    } catch {
      addToast('Export failed', 'error');
    }
  };

  const openEditModal = (menu: Menu, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMenu(menu);
    setFormData({ name: menu.name, restaurant_name: menu.restaurant_name || '', description: menu.description || '' });
    setShowNewModal(true);
  };

  const closeModal = () => {
    setShowNewModal(false);
    setEditingMenu(null);
    setFormData({ name: '', restaurant_name: '', description: '' });
  };

  const handleCardClick = (id: number) => navigate(`/menu/${id}`);
  const handleFeatureClick = (path: string) => navigate(path);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Menu Digitizer</h1>
          <p className="text-gray-600 mt-1">Transform your menus with AI-powered features</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-1 text-sm">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={() => handleExport('pdf')} className="btn-secondary flex items-center gap-1 text-sm">
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-5 w-5" /> New Menu
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button onClick={() => setActiveTab('features')} className={`px-6 py-3 font-medium text-sm transition-all border-b-2 -mb-px ${activeTab === 'features' ? 'text-primary-600 border-primary-500' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
          <div className="flex items-center gap-2"><Brain className="h-4 w-4" /> AI Features</div>
        </button>
        <button onClick={() => setActiveTab('menus')} className={`px-6 py-3 font-medium text-sm transition-all border-b-2 -mb-px ${activeTab === 'menus' ? 'text-primary-600 border-primary-500' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
          <div className="flex items-center gap-2"><MenuIcon className="h-4 w-4" /> My Menus ({total || menus.length})</div>
        </button>
      </div>

      {/* AI Features Grid */}
      {activeTab === 'features' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureCards.map((feature) => (
            <div key={feature.id} onClick={() => handleFeatureClick(feature.path)} className="relative overflow-hidden rounded-2xl cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:shadow-xl">
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-90 group-hover:opacity-100 transition-opacity`}></div>
              <div className="relative p-6 text-white">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-white/80 text-sm mb-4">{feature.description}</p>
                <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
                  <span>Explore</span><ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Menus Grid */}
      {activeTab === 'menus' && (
        <>
          {/* Search & Sort */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search menus..." />
            <SortControls
              options={[
                { label: 'Date', value: 'created_at' },
                { label: 'Name', value: 'name' },
                { label: 'Restaurant', value: 'restaurant_name' },
              ]}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(s, o) => { setSortBy(s); setSortOrder(o); }}
            />
          </div>

          <BulkActionBar
            selectedCount={selectedIds.size}
            onDelete={() => setConfirmDelete({ open: true })}
            onClear={() => setSelectedIds(new Set())}
            entityName="menus"
          />

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : menus.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm">
              <MenuIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No menus yet</h3>
              <p className="text-gray-600 mb-6">Create your first menu to get started</p>
              <button onClick={() => setShowNewModal(true)} className="btn-primary inline-flex items-center gap-2"><Plus className="h-5 w-5" /> Create Menu</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menus.map((menu) => (
                <div
                  key={menu.id}
                  onClick={() => handleCardClick(menu.id)}
                  className={`card p-6 cursor-pointer hover:border-primary-300 border-2 transition-all group ${
                    selectedIds.has(menu.id) ? 'border-primary-500 bg-primary-50' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(menu.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          const next = new Set(selectedIds);
                          if (next.has(menu.id)) next.delete(menu.id); else next.add(menu.id);
                          setSelectedIds(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 text-primary-500"
                      />
                      <div className="p-3 bg-primary-100 rounded-lg"><Utensils className="h-6 w-6 text-primary-600" /></div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => openEditModal(menu, e)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><Edit className="h-4 w-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ open: true, id: menu.id }); }} className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{menu.name}</h3>
                  {menu.restaurant_name && <p className="text-primary-600 text-sm font-medium mb-2">{menu.restaurant_name}</p>}
                  {menu.description && <p className="text-gray-600 text-sm line-clamp-2 mb-4">{menu.description}</p>}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Utensils className="h-4 w-4" /> {menu.item_count} items</span>
                      <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(menu.created_at).toLocaleDateString()}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
        </>
      )}

      {/* Quick Stats */}
      {activeTab === 'features' && menus.length > 0 && (
        <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm"><div className="text-3xl font-bold text-primary-600">{total || menus.length}</div><div className="text-sm text-gray-600">Total Menus</div></div>
            <div className="bg-white p-4 rounded-xl shadow-sm"><div className="text-3xl font-bold text-green-600">{menus.reduce((acc, m) => acc + parseInt(m.item_count || '0'), 0)}</div><div className="text-sm text-gray-600">Total Items</div></div>
            <div className="bg-white p-4 rounded-xl shadow-sm"><div className="text-3xl font-bold text-blue-600">6</div><div className="text-sm text-gray-600">AI Features</div></div>
            <div className="bg-white p-4 rounded-xl shadow-sm"><div className="text-3xl font-bold text-purple-600">15+</div><div className="text-sm text-gray-600">Languages</div></div>
          </div>
        </div>
      )}

      {/* New/Edit Menu Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold">{editingMenu ? 'Edit Menu' : 'Create New Menu'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Menu Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="e.g., Lunch Menu" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name</label>
                <input type="text" value={formData.restaurant_name} onChange={(e) => setFormData({ ...formData, restaurant_name: e.target.value })} className="input-field" placeholder="e.g., Bella Italia" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" rows={3} placeholder="Brief description..." />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editingMenu ? 'Save Changes' : 'Create Menu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete.open}
        title={confirmDelete.id ? 'Delete Menu' : `Delete ${selectedIds.size} Menus`}
        message={confirmDelete.id ? 'Are you sure you want to delete this menu? All items and data will be lost.' : `Are you sure you want to delete ${selectedIds.size} menus?`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => confirmDelete.id ? handleDelete() : handleBulkDelete()}
        onCancel={() => setConfirmDelete({ open: false })}
      />
    </div>
  );
}
