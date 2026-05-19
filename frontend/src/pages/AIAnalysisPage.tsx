import { useState, useEffect } from 'react';
import { menuApi, aiApi } from '../services/api';
import {
  Brain,
  Upload,
  FileText,
  Loader2,
  History,
  Clock,
  Zap,
  Camera,
  Type,
  Plus,
  Check,
  Save,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import AIResultDisplay from '../components/AIResultDisplay';
import { useToast } from '../context/ToastContext';
import Pagination from '../components/Pagination';
import { SkeletonTable } from '../components/Skeleton';

interface Menu {
  id: number;
  name: string;
  restaurant_name: string;
}

interface AIHistory {
  id: number;
  menu_id: number;
  menu_name: string;
  restaurant_name: string;
  analysis_type: string;
  input_data: string;
  output_data: any;
  model_used: string;
  tokens_used: number;
  created_at: string;
}

interface ExtractedItem {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  spice_level?: number;
  selected?: boolean;
}

const SAMPLE_MENU_DATA = `🍽️ LA BELLA ITALIA RESTAURANT 🍽️
Family-owned Italian cuisine since 1985

═══════════════════════════════════════
🥗 APPETIZERS
═══════════════════════════════════════

Bruschetta Classica - $8.99
Toasted ciabatta bread topped with fresh tomatoes, garlic, basil, and extra virgin olive oil (Vegetarian, Vegan)

Calamari Fritti - $14.99
Crispy fried squid rings served with marinara sauce and lemon aioli

Caprese Salad - $12.99
Fresh buffalo mozzarella, vine-ripened tomatoes, fresh basil, balsamic glaze (Vegetarian, Gluten-Free)

Beef Carpaccio - $16.99
Thinly sliced raw beef tenderloin with arugula, capers, parmesan shavings, and truffle oil

Stuffed Mushrooms - $11.99
Portobello mushrooms filled with herbed cream cheese, spinach, and breadcrumbs (Vegetarian)

═══════════════════════════════════════
🍝 PASTA
═══════════════════════════════════════

Spaghetti Carbonara - $18.99
Classic Roman pasta with pancetta, egg yolk, pecorino romano, and black pepper

Fettuccine Alfredo - $16.99
Homemade fettuccine in creamy parmesan sauce (Vegetarian)

Penne Arrabbiata - $15.99
Penne pasta in spicy tomato sauce with garlic and red chili flakes (Vegetarian, Vegan)

Seafood Linguine - $24.99
Linguine with shrimp, mussels, clams, and calamari in white wine garlic sauce

Lasagna Bolognese - $19.99
Layers of pasta, beef and pork ragù, béchamel sauce, and mozzarella

Gnocchi ai Quattro Formaggi - $17.99
Potato gnocchi with four cheese sauce: gorgonzola, fontina, parmesan, mozzarella (Vegetarian)

═══════════════════════════════════════
🍕 PIZZA
═══════════════════════════════════════

Margherita - $14.99
San Marzano tomato sauce, fresh mozzarella, basil (Vegetarian)

Pepperoni - $16.99
Tomato sauce, mozzarella, spicy pepperoni

Quattro Stagioni - $18.99
Four seasons: artichokes, ham, mushrooms, olives

Prosciutto e Rucola - $19.99
Tomato sauce, mozzarella, prosciutto di Parma, fresh arugula, parmesan shavings

Vegetariana - $16.99
Grilled zucchini, bell peppers, eggplant, onions, cherry tomatoes (Vegetarian)

Diavola - $17.99
Spicy salami, jalapeños, tomato sauce, mozzarella 🌶️🌶️ (Spicy)

═══════════════════════════════════════
🥩 MAIN COURSES
═══════════════════════════════════════

Chicken Parmigiana - $22.99
Breaded chicken breast with marinara sauce, melted mozzarella, served with spaghetti

Osso Buco - $32.99
Braised veal shanks in white wine, vegetables, and gremolata, served with risotto Milanese

Grilled Salmon - $26.99
Atlantic salmon with lemon butter sauce, roasted vegetables, and herb potatoes (Gluten-Free)

Veal Piccata - $28.99
Tender veal medallions in lemon caper butter sauce with angel hair pasta

Eggplant Parmigiana - $18.99
Layers of fried eggplant, marinara, mozzarella, and parmesan (Vegetarian)

Lamb Chops - $34.99
Grilled lamb chops with rosemary, garlic, mint sauce, and roasted potatoes (Gluten-Free)

═══════════════════════════════════════
🍰 DESSERTS
═══════════════════════════════════════

Tiramisu - $9.99
Classic Italian dessert with espresso-soaked ladyfingers and mascarpone cream (Vegetarian)

Panna Cotta - $8.99
Vanilla bean cream pudding with berry compote (Vegetarian, Gluten-Free)

Cannoli - $7.99
Crispy pastry shells filled with sweet ricotta cream and chocolate chips (Vegetarian)

Gelato (3 scoops) - $6.99
Ask your server for today's flavors (Vegetarian, Gluten-Free)

Chocolate Lava Cake - $10.99
Warm chocolate cake with molten center, vanilla gelato (Vegetarian)

═══════════════════════════════════════
🍷 BEVERAGES
═══════════════════════════════════════

Italian Soda - $4.99
Sparkling water with your choice of fruit syrup

Espresso - $3.99
Cappuccino - $4.99
House Wine (glass) - $8.99
Limoncello - $7.99

═══════════════════════════════════════
⚠️ Please inform your server of any food allergies
🌱 V = Vegetarian | VG = Vegan | GF = Gluten-Free
🌶️ = Spicy
═══════════════════════════════════════`;

export default function AIAnalysisPage() {
  const { addToast } = useToast();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'image' | 'text' | 'pdf'>('text');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<AIHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null);

  // Pagination state for history
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);

  // Image analysis
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Text analysis
  const [menuText, setMenuText] = useState('');

  // PDF analysis
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Import states
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMenuId, setImportMenuId] = useState<number | null>(null);

  useEffect(() => {
    fetchMenus();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (showHistory) {
      fetchHistory();
    }
  }, [historyPage, historyLimit]);

  useEffect(() => {
    // Extract items from result when it changes
    if (result?.analysis?.items) {
      setExtractedItems(result.analysis.items.map((item: any) => ({
        ...item,
        selected: true
      })));
    }
  }, [result]);

  const fetchMenus = async () => {
    try {
      const response = await menuApi.getAll();
      setMenus(response.data);
      if (response.data.length > 0) {
        setSelectedMenu(response.data[0].id);
        setImportMenuId(response.data[0].id);
      }
    } catch (error) {
      addToast('Error fetching menus', 'error');
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await aiApi.getHistory();
      const allHistory = Array.isArray(response.data) ? response.data : [];
      // Client-side pagination since API may not support it
      setHistoryTotal(allHistory.length);
      setHistoryTotalPages(Math.ceil(allHistory.length / historyLimit) || 1);
      const start = (historyPage - 1) * historyLimit;
      setHistory(allHistory.slice(start, start + historyLimit));
    } catch (error) {
      addToast('Error fetching history', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageAnalysis = async () => {
    if (!imagePreview) return;
    setLoading(true);
    setResult(null);
    setExtractedItems([]);
    setImportSuccess(false);
    try {
      const response = await aiApi.analyzeImage(imagePreview, selectedMenu || undefined);
      setResult(response.data);
      addToast('Image analysis complete', 'success');
      fetchHistory();
    } catch (error) {
      addToast('Error analyzing image', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTextAnalysis = async () => {
    if (!menuText.trim()) return;
    setLoading(true);
    setResult(null);
    setExtractedItems([]);
    setImportSuccess(false);
    try {
      const response = await aiApi.analyzeText(menuText, selectedMenu || undefined);
      setResult(response.data);
      addToast('Text analysis complete', 'success');
      fetchHistory();
    } catch (error) {
      addToast('Error analyzing text', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPdfFile(file);
  };

  const handlePdfAnalysis = async () => {
    if (!pdfFile) return;
    setPdfLoading(true);
    setResult(null);
    setExtractedItems([]);
    setImportSuccess(false);
    try {
      // Read the PDF file as text using FileReader (the text will be sent to backend)
      // For a real implementation, the backend would parse with pdf-parse
      // Here we send the raw file content as base64 and the backend extracts text
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const base64 = (ev.target?.result as string).split(',')[1];
          // We pass pdfText as a signal to the backend that it is base64-encoded PDF
          const response = await aiApi.analyzePdfMenu(`[PDF_BASE64]:${base64}`, selectedMenu || undefined);
          setResult(response.data);
          addToast('PDF analysis complete', 'success');
          fetchHistory();
        } catch (error) {
          addToast('Error analyzing PDF', 'error');
        } finally {
          setPdfLoading(false);
        }
      };
      reader.readAsDataURL(pdfFile);
    } catch (error) {
      addToast('Error reading PDF file', 'error');
      setPdfLoading(false);
    }
  };

  const toggleItemSelection = (index: number) => {
    setExtractedItems(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const selectAllItems = () => {
    setExtractedItems(prev => prev.map(item => ({ ...item, selected: true })));
  };

  const deselectAllItems = () => {
    setExtractedItems(prev => prev.map(item => ({ ...item, selected: false })));
  };

  const importSelectedItems = async () => {
    if (!importMenuId) return;

    const selectedItems = extractedItems.filter(item => item.selected);
    if (selectedItems.length === 0) return;

    setImporting(true);
    try {
      for (const item of selectedItems) {
        await menuApi.createItem(importMenuId, {
          name: item.name,
          description: item.description || '',
          price: item.price || 0,
          category: item.category || 'Uncategorized',
          is_vegetarian: item.is_vegetarian || false,
          is_vegan: item.is_vegan || false,
          is_gluten_free: item.is_gluten_free || false,
          spice_level: item.spice_level || 0
        });
      }
      setImportSuccess(true);
      setShowImportModal(false);
      addToast(`${selectedItems.length} items imported successfully`, 'success');
    } catch (error) {
      addToast('Error importing items', 'error');
    } finally {
      setImporting(false);
    }
  };

  const getAnalysisTypeLabel = (type: string) => {
    switch (type) {
      case 'menu_digitization': return 'Menu Digitization';
      case 'text_parsing': return 'Text Parsing';
      case 'allergen_detection': return 'Allergen Detection';
      case 'calorie_estimation': return 'Calorie Estimation';
      case 'translation': return 'Translation';
      default: return type;
    }
  };

  const getAnalysisTypeColor = (type: string) => {
    switch (type) {
      case 'menu_digitization':
      case 'text_parsing':
        return 'bg-purple-100 text-purple-800';
      case 'allergen_detection':
        return 'bg-yellow-100 text-yellow-800';
      case 'calorie_estimation':
        return 'bg-orange-100 text-orange-800';
      case 'translation':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-7 w-7 text-purple-500" />
            AI Analysis
          </h1>
          <p className="text-gray-600 mt-1">Digitize menus using AI-powered analysis</p>
        </div>
        <button
          onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
          className="btn-secondary flex items-center gap-2"
        >
          <History className="h-5 w-5" />
          {showHistory ? 'New Analysis' : 'View History'}
        </button>
      </div>

      {showHistory ? (
        /* History View */
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Analysis History</h2>
          {historyLoading ? (
            <SkeletonTable rows={5} />
          ) : history.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm">
              <History className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No history yet</h3>
              <p className="text-gray-600">Your AI analysis history will appear here</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {history.map(item => (
                    <div key={item.id} className="hover:bg-gray-50">
                      <div
                        onClick={() => setExpandedHistory(expandedHistory === item.id ? null : item.id)}
                        className="p-4 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getAnalysisTypeColor(item.analysis_type)}`}>
                                {getAnalysisTypeLabel(item.analysis_type)}
                              </span>
                              <span className="text-sm text-gray-500">{item.menu_name}</span>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-1">
                              {item.input_data?.substring(0, 100)}...
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(item.created_at).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                {item.tokens_used} tokens
                              </span>
                              <span>{item.model_used}</span>
                            </div>
                          </div>
                          {expandedHistory === item.id ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded result */}
                      {expandedHistory === item.id && item.output_data && (
                        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                          <div className="mt-4">
                            <AIResultDisplay
                              title="Analysis Result"
                              result={{ analysis: item.output_data, tokensUsed: item.tokens_used }}
                              type={item.analysis_type.includes('allergen') ? 'allergens' :
                                    item.analysis_type.includes('calorie') ? 'calories' :
                                    item.analysis_type.includes('translation') ? 'translation' : 'menu'}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagination for history */}
              <Pagination
                page={historyPage}
                totalPages={historyTotalPages}
                total={historyTotal}
                limit={historyLimit}
                onPageChange={setHistoryPage}
                onLimitChange={(l) => { setHistoryLimit(l); setHistoryPage(1); }}
              />
            </>
          )}
        </div>
      ) : (
        /* Analysis Interface */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            {/* Menu Selection */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Save results to menu (optional)
              </label>
              <select
                value={selectedMenu || ''}
                onChange={(e) => setSelectedMenu(e.target.value ? Number(e.target.value) : null)}
                className="input-field"
              >
                <option value="">Don't save to menu</option>
                {menus.map(menu => (
                  <option key={menu.id} value={menu.id}>
                    {menu.name} - {menu.restaurant_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                    activeTab === 'text'
                      ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Type className="h-4 w-4" />
                  Text Input
                </button>
                <button
                  onClick={() => setActiveTab('image')}
                  className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                    activeTab === 'image'
                      ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  Image Upload
                </button>
                <button
                  onClick={() => setActiveTab('pdf')}
                  className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                    activeTab === 'pdf'
                      ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  PDF Upload
                </button>
              </div>

              <div className="p-4">
                {activeTab === 'text' ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Paste menu text
                        </label>
                        <button
                          type="button"
                          onClick={() => setMenuText(SAMPLE_MENU_DATA)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm"
                        >
                          <Sparkles className="h-4 w-4" />
                          Load Sample Menu
                        </button>
                      </div>
                      <textarea
                        value={menuText}
                        onChange={(e) => setMenuText(e.target.value)}
                        className="input-field"
                        rows={12}
                        placeholder={`Paste your menu text here, or click "Load Sample Menu" to try with demo data...`}
                      />
                    </div>

                    <button
                      onClick={handleTextAnalysis}
                      disabled={loading || !menuText.trim()}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Brain className="h-5 w-5" />
                      )}
                      {loading ? 'Analyzing...' : 'Analyze Menu Text'}
                    </button>
                  </div>
                ) : activeTab === 'image' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload menu image
                      </label>

                      {imagePreview ? (
                        <div className="relative">
                          <img
                            src={imagePreview}
                            alt="Menu preview"
                            className="w-full rounded-lg border border-gray-200 max-h-80 object-contain"
                          />
                          <button
                            onClick={() => setImagePreview(null)}
                            className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
                          >
                            <span className="sr-only">Remove</span>
                            ×
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                          <Upload className="h-10 w-10 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600">Click to upload or drag and drop</span>
                          <span className="text-xs text-gray-500 mt-1">PNG, JPG, WebP up to 10MB</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={handleImageUpload}
                          />
                        </label>
                      )}
                    </div>

                    <button
                      onClick={handleImageAnalysis}
                      disabled={loading || !imagePreview}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Brain className="h-5 w-5" />
                      )}
                      {loading ? 'Analyzing...' : 'Analyze Menu Image'}
                    </button>
                  </div>
                ) : (
                  /* PDF Upload Tab */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload PDF Menu
                      </label>
                      <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                        <FileText className="h-10 w-10 text-gray-400 mb-2" />
                        {pdfFile ? (
                          <>
                            <span className="text-sm font-medium text-gray-700">{pdfFile.name}</span>
                            <span className="text-xs text-gray-500 mt-1">
                              {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-sm text-gray-600">Click to upload PDF menu</span>
                            <span className="text-xs text-gray-500 mt-1">PDF up to 10MB</span>
                          </>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept="application/pdf"
                          onChange={handlePdfUpload}
                        />
                      </label>
                    </div>

                    <button
                      onClick={handlePdfAnalysis}
                      disabled={pdfLoading || !pdfFile}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {pdfLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Brain className="h-5 w-5" />
                      )}
                      {pdfLoading ? 'Analyzing PDF...' : 'Analyze PDF Menu'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-500" />
                Tips for best results
              </h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>Include prices with items when available</li>
                <li>Organize items by categories (Appetizers, Mains, Desserts)</li>
                <li>Include descriptions for better allergen detection</li>
                <li>For images, ensure text is clearly visible</li>
              </ul>
            </div>
          </div>

          {/* Results Section */}
          <div>
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-400" />
                Analysis Results
              </h2>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-12 w-12 text-primary-500 animate-spin mb-4" />
                  <p className="text-gray-600">Analyzing menu...</p>
                  <p className="text-sm text-gray-500 mt-1">This may take a few moments</p>
                </div>
              ) : result ? (
                <div>
                  <AIResultDisplay
                    title="Extracted Menu Items"
                    result={result}
                    type="menu"
                  />

                  {/* Import Section */}
                  {extractedItems.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-900">Import to Menu</h3>
                        {importSuccess && (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <Check className="h-4 w-4" />
                            Imported successfully!
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => setShowImportModal(true)}
                        disabled={importSuccess}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                      >
                        <Plus className="h-5 w-5" />
                        Import {extractedItems.filter(i => i.selected).length} Items to Menu
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Brain className="h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No results yet</h3>
                  <p className="text-gray-600 max-w-sm">
                    Upload a menu image or paste menu text to extract structured data using AI
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="text-xl font-semibold">Import Items to Menu</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Menu Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Target Menu *
                </label>
                <select
                  value={importMenuId || ''}
                  onChange={(e) => setImportMenuId(Number(e.target.value))}
                  className="input-field"
                  required
                >
                  <option value="">Select a menu...</option>
                  {menus.map(menu => (
                    <option key={menu.id} value={menu.id}>
                      {menu.name} - {menu.restaurant_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selection Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllItems}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={deselectAllItems}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Deselect All
                </button>
                <span className="ml-auto text-sm text-gray-500">
                  {extractedItems.filter(i => i.selected).length} of {extractedItems.length} selected
                </span>
              </div>

              {/* Items List */}
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {extractedItems.map((item, index) => (
                  <label
                    key={index}
                    className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50 ${
                      item.selected ? 'bg-primary-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleItemSelection(index)}
                      className="mt-1 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{item.name}</span>
                        {item.price && (
                          <span className="text-primary-600 font-medium">
                            ${item.price.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.category && (
                          <span className="badge-blue text-xs">{item.category}</span>
                        )}
                        {item.is_vegetarian && (
                          <span className="badge-green text-xs">Vegetarian</span>
                        )}
                        {item.is_vegan && (
                          <span className="badge-green text-xs">Vegan</span>
                        )}
                        {item.is_gluten_free && (
                          <span className="badge-yellow text-xs">Gluten Free</span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={importSelectedItems}
                  disabled={importing || !importMenuId || extractedItems.filter(i => i.selected).length === 0}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      Import Selected Items
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
