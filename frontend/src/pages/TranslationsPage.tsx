import { useState, useEffect } from 'react';
import { menuApi, translationApi, aiApi } from '../services/api';
import {
  Languages,
  Plus,
  X,
  Edit,
  Trash2,
  Brain,
  Loader2,
  Globe,
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
import TranslationDetail from '../components/details/TranslationDetail';

interface Menu {
  id: number;
  name: string;
  restaurant_name: string;
}

interface Translation {
  id: number;
  menu_item_id: number;
  original_name: string;
  original_description: string;
  language_code: string;
  language_name: string;
  translated_name: string;
  translated_description: string;
  category: string;
}

interface Language {
  code: string;
  name: string;
}

export default function TranslationsPage() {
  const { addToast } = useToast();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<number | null>(null);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTranslation, setEditingTranslation] = useState<Translation | null>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    menu_item_id: '',
    language_code: '',
    language_name: '',
    translated_name: '',
    translated_description: ''
  });
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiLoading, setAILoading] = useState(false);
  const [aiResult, setAIResult] = useState<any>(null);
  const [aiInput, setAIInput] = useState({ itemName: '', description: '', targetLanguage: 'Spanish', menuItemId: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
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
  const [drawerItem, setDrawerItem] = useState<Translation | null>(null);

  useEffect(() => {
    fetchMenus();
    fetchLanguages();
  }, []);

  useEffect(() => {
    if (selectedMenu) {
      fetchTranslations();
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

  const fetchLanguages = async () => {
    try {
      const response = await translationApi.getLanguages();
      setLanguages(response.data);
    } catch (error) {
      addToast('Error fetching languages', 'error');
    }
  };

  const fetchTranslations = async () => {
    if (!selectedMenu) return;
    setLoading(true);
    try {
      const response = await translationApi.getByMenu(selectedMenu, {
        page, limit, search: searchTerm, sortBy, sortOrder
      });
      if (response.data?.data) {
        setTranslations(response.data.data);
        setTotal(response.data.pagination?.total || response.data.data.length);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        setTranslations(Array.isArray(response.data) ? response.data : []);
        setTotal(Array.isArray(response.data) ? response.data.length : 0);
        setTotalPages(1);
      }
    } catch (error) {
      addToast('Error fetching translations', 'error');
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
      const selectedLang = languages.find(l => l.code === formData.language_code);
      const data = {
        ...formData,
        menu_item_id: parseInt(formData.menu_item_id),
        language_name: selectedLang?.name || formData.language_name
      };

      if (editingTranslation) {
        await translationApi.update(editingTranslation.id, data);
        addToast('Translation updated successfully', 'success');
      } else {
        await translationApi.create(data);
        addToast('Translation added successfully', 'success');
      }
      fetchTranslations();
      closeModal();
    } catch (error) {
      addToast('Error saving translation', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await translationApi.delete(id);
      addToast('Translation deleted successfully', 'success');
      setDrawerItem(null);
      fetchTranslations();
    } catch (error) {
      addToast('Error deleting translation', 'error');
    }
    setConfirmDelete({ open: false });
  };

  const handleBulkDelete = async () => {
    try {
      await translationApi.bulkDelete(Array.from(selectedIds));
      addToast(`${selectedIds.size} translations deleted`, 'success');
      setSelectedIds(new Set());
      fetchTranslations();
    } catch (error) {
      addToast('Error deleting translations', 'error');
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

  const openEditModal = (translation: Translation) => {
    setEditingTranslation(translation);
    setFormData({
      menu_item_id: translation.menu_item_id.toString(),
      language_code: translation.language_code,
      language_name: translation.language_name,
      translated_name: translation.translated_name,
      translated_description: translation.translated_description || ''
    });
    setShowModal(true);
    setDrawerItem(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTranslation(null);
    setFormData({
      menu_item_id: '',
      language_code: '',
      language_name: '',
      translated_name: '',
      translated_description: ''
    });
  };

  const handleAITranslate = async () => {
    if (!aiInput.itemName || !aiInput.targetLanguage) return;
    setAILoading(true);
    setSaved(false);
    try {
      const response = await aiApi.translate(
        aiInput.itemName,
        aiInput.description,
        aiInput.targetLanguage,
        aiInput.menuItemId ? parseInt(aiInput.menuItemId) : undefined
      );
      setAIResult(response.data);
      addToast('AI translation complete', 'success');
    } catch (error) {
      addToast('Error translating', 'error');
    } finally {
      setAILoading(false);
    }
  };

  const saveAIResults = async () => {
    if (!aiResult?.analysis?.translation || !aiInput.menuItemId) return;

    setSaving(true);
    try {
      const t = aiResult.analysis.translation;
      await translationApi.create({
        menu_item_id: parseInt(aiInput.menuItemId),
        language_code: t.language_code || 'es',
        language_name: t.language_name || aiInput.targetLanguage,
        translated_name: t.translated_name,
        translated_description: t.translated_description || ''
      });
      setSaved(true);
      addToast('Translation saved to database', 'success');
      fetchTranslations();
    } catch (error) {
      addToast('Error saving translation', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectMenuItem = (itemId: string) => {
    const item = menuItems.find(i => i.id.toString() === itemId);
    if (item) {
      setAIInput(prev => ({
        ...prev,
        itemName: item.name,
        description: item.description || '',
        menuItemId: itemId
      }));
    }
  };

  // Filter by language client-side (in addition to server search)
  const filteredTranslations = filterLanguage
    ? translations.filter(t => t.language_code === filterLanguage)
    : translations;

  // Get unique languages in translations
  const usedLanguages = [...new Set(translations.map(t => t.language_code))];

  const sortOptions = [
    { label: 'Date Created', value: 'created_at' },
    { label: 'Original Name', value: 'original_name' },
    { label: 'Language', value: 'language_name' },
    { label: 'Translated Name', value: 'translated_name' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Languages className="h-7 w-7 text-blue-500" />
            Menu Translations
          </h1>
          <p className="text-gray-600 mt-1">Translate menu items to multiple languages</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setShowAIModal(true); setSaved(false); setAIResult(null); }}
            className="btn-secondary flex items-center gap-2"
          >
            <Brain className="h-5 w-5" />
            AI Translate
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Translation
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <Globe className="h-8 w-8 opacity-80" />
            <div>
              <p className="text-white/80 text-sm">Languages</p>
              <p className="text-2xl font-bold">{usedLanguages.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <Languages className="h-8 w-8 opacity-80" />
            <div>
              <p className="text-white/80 text-sm">Translations</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <SearchBar
          value={searchTerm}
          onChange={(v) => { setSearchTerm(v); setPage(1); }}
          placeholder="Search translations..."
        />
        <SortControls
          options={sortOptions}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(s, o) => { setSortBy(s); setSortOrder(o); }}
        />
        <select
          value={filterLanguage}
          onChange={(e) => setFilterLanguage(e.target.value)}
          className="input-field w-full sm:w-48"
        >
          <option value="">All Languages</option>
          {usedLanguages.map(code => {
            const lang = languages.find(l => l.code === code);
            return (
              <option key={code} value={code}>{lang?.name || code}</option>
            );
          })}
        </select>
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
        entityName="translations"
      />

      {/* Translations Table */}
      {loading ? (
        <SkeletonTable rows={5} />
      ) : filteredTranslations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm">
          <Languages className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No translations found</h3>
          <p className="text-gray-600">Add translations for menu items</p>
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
                      checked={selectedIds.size === filteredTranslations.length && filteredTranslations.length > 0}
                      onChange={() => {
                        if (selectedIds.size === filteredTranslations.length) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(filteredTranslations.map(t => t.id)));
                        }
                      }}
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Original</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Language</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Translated</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTranslations.map(translation => (
                  <tr
                    key={translation.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setDrawerItem(translation)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(translation.id)}
                        onChange={() => toggleSelect(translation.id)}
                        className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{translation.original_name}</p>
                        {translation.original_description && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{translation.original_description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <Globe className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700">{translation.language_name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-blue-700">{translation.translated_name}</p>
                        {translation.translated_description && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{translation.translated_description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(translation)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ open: true, id: translation.id })}
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
        title="Translation Details"
        onClose={() => setDrawerItem(null)}
        onEdit={() => drawerItem && openEditModal(drawerItem)}
        onDelete={() => drawerItem && setConfirmDelete({ open: true, id: drawerItem.id })}
      >
        {drawerItem && <TranslationDetail translation={drawerItem} />}
      </DetailDrawer>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete.open}
        title={confirmDelete.id ? 'Delete Translation' : 'Delete Selected Translations'}
        message={confirmDelete.id
          ? 'Are you sure you want to delete this translation? This action cannot be undone.'
          : `Are you sure you want to delete ${selectedIds.size} selected translations? This action cannot be undone.`
        }
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => confirmDelete.id ? handleDelete(confirmDelete.id) : handleBulkDelete()}
        onCancel={() => setConfirmDelete({ open: false })}
      />

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold">
                {editingTranslation ? 'Edit Translation' : 'Add Translation'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Menu Item *</label>
                <select value={formData.menu_item_id} onChange={(e) => setFormData({ ...formData, menu_item_id: e.target.value })} className="input-field" required>
                  <option value="">Select item...</option>
                  {menuItems.map(item => (<option key={item.id} value={item.id}>{item.name}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language *</label>
                <select
                  value={formData.language_code}
                  onChange={(e) => {
                    const lang = languages.find(l => l.code === e.target.value);
                    setFormData({ ...formData, language_code: e.target.value, language_name: lang?.name || '' });
                  }}
                  className="input-field" required
                >
                  <option value="">Select language...</option>
                  {languages.map(lang => (<option key={lang.code} value={lang.code}>{lang.name}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Translated Name *</label>
                <input type="text" value={formData.translated_name} onChange={(e) => setFormData({ ...formData, translated_name: e.target.value })} className="input-field" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Translated Description</label>
                <textarea value={formData.translated_description} onChange={(e) => setFormData({ ...formData, translated_description: e.target.value })} className="input-field" rows={3} />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">{editingTranslation ? 'Save Changes' : 'Add Translation'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Translation Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                AI Translation
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
                  {menuItems.map(item => (<option key={item.id} value={item.id}>{item.name}</option>))}
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
                    itemName: 'Chicken Tikka Masala',
                    description: 'Tender chicken pieces marinated in yogurt and spices, cooked in a rich creamy tomato-based curry sauce with aromatic spices. Served with basmati rice and warm naan bread.',
                    targetLanguage: 'Spanish',
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
                <input type="text" value={aiInput.itemName} onChange={(e) => setAIInput({ ...aiInput, itemName: e.target.value })} className="input-field" placeholder="e.g., Chicken Tikka Masala" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={aiInput.description} onChange={(e) => setAIInput({ ...aiInput, description: e.target.value })} className="input-field" rows={2} placeholder="Describe the dish..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Language *</label>
                <select value={aiInput.targetLanguage} onChange={(e) => setAIInput({ ...aiInput, targetLanguage: e.target.value })} className="input-field">
                  {languages.map(lang => (<option key={lang.code} value={lang.name}>{lang.name}</option>))}
                </select>
              </div>

              <button
                onClick={handleAITranslate}
                disabled={aiLoading || !aiInput.itemName}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {aiLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Brain className="h-5 w-5" />}
                {aiLoading ? 'Translating...' : 'Translate'}
              </button>

              {aiResult && (
                <>
                  <AIResultDisplay title="Translation Result" result={aiResult} type="translation" />
                  {aiResult.analysis?.translation && aiInput.menuItemId && (
                    <div className="pt-4 border-t border-gray-200">
                      <button onClick={saveAIResults} disabled={saving || saved} className="btn-primary w-full flex items-center justify-center gap-2">
                        {saved ? (<><Check className="h-5 w-5" />Saved to Database!</>) : saving ? (<><Loader2 className="h-5 w-5 animate-spin" />Saving...</>) : (<><Save className="h-5 w-5" />Save Translation to Database</>)}
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
