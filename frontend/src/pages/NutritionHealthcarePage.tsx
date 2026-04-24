import { useState, useEffect } from 'react';
import { menuApi, aiApi } from '../services/api';
import AIResultDisplay from '../components/AIResultDisplay';
import {
  Heart,
  Loader2,
  ChevronDown,
  Stethoscope,
  Activity,
  AlertCircle,
  Sparkles
} from 'lucide-react';

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

export default function NutritionHealthcarePage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [healthConditions, setHealthConditions] = useState('');

  const conditionOptions = [
    'Diabetes',
    'Heart Disease',
    'High Blood Pressure',
    'High Cholesterol',
    'Obesity',
    'Kidney Disease',
    'Celiac Disease',
    'IBS',
    'Gout',
    'Pregnancy'
  ];

  useEffect(() => {
    fetchMenus();
  }, []);

  useEffect(() => {
    if (selectedMenu) {
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
      console.error('Error fetching menus:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuDetails = async (menuId: number) => {
    try {
      const response = await menuApi.getById(menuId);
      setSelectedMenu(response.data);
    } catch (error) {
      console.error('Error fetching menu details:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedItem) return;

    setAnalyzing(true);
    setAiResult(null);

    try {
      const response = await aiApi.analyzeNutritionHealthcare(
        selectedItem.name,
        selectedItem.description || '',
        healthConditions,
        selectedItem.id
      );

      setAiResult(response.data);
    } catch (error) {
      console.error('Error analyzing nutrition:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleCondition = (condition: string) => {
    const current = healthConditions.split(',').map(s => s.trim()).filter(Boolean);
    if (current.includes(condition)) {
      setHealthConditions(current.filter(c => c !== condition).join(', '));
    } else {
      setHealthConditions([...current, condition].join(', '));
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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
            <Heart className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Nutrition Analyzer</h1>
            <p className="text-gray-600">Healthcare-focused nutrition analysis for dietary needs</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <Stethoscope className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Healthcare Analysis Mode</h3>
            <p className="text-sm text-blue-700 mt-1">
              This feature provides detailed nutrition analysis considering specific health conditions.
              Always consult with a healthcare professional for medical dietary advice.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-6">Analyze Food Item</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left - Form */}
          <div className="space-y-4">
            {/* Menu Selection */}
            <div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Food Item</label>
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
                      {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Selected Item Preview */}
            {selectedItem && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="font-medium text-gray-900">{selectedItem.name}</div>
                <div className="text-sm text-gray-600 mt-1">{selectedItem.description}</div>
                <div className="text-sm text-gray-500 mt-2">{selectedItem.category}</div>
              </div>
            )}
          </div>

          {/* Right - Health Conditions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Health Conditions (Optional)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Select any health conditions for personalized analysis
            </p>
            <div className="flex flex-wrap gap-2">
              {conditionOptions.map(condition => (
                <button
                  key={condition}
                  type="button"
                  onClick={() => toggleCondition(condition)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    healthConditions.includes(condition)
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {condition}
                </button>
              ))}
            </div>

            {healthConditions && (
              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Analysis will consider: {healthConditions}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (selectedMenu?.items && selectedMenu.items.length > 0) {
              setSelectedItem(selectedMenu.items[0]);
            }
            setHealthConditions('Diabetes, High Blood Pressure, High Cholesterol');
          }}
          disabled={!selectedMenu?.items?.length}
          className="w-full mt-6 inline-flex items-center justify-center gap-1 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-sm"
        >
          <Sparkles className="h-4 w-4" />
          Load Sample Data
        </button>

        <button
          onClick={handleAnalyze}
          disabled={!selectedItem || analyzing}
          className="w-full mt-3 btn-primary flex items-center justify-center gap-2"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Analyzing Nutrition...
            </>
          ) : (
            <>
              <Activity className="h-5 w-5" />
              Analyze for Health
            </>
          )}
        </button>
      </div>

      {/* AI Result */}
      {aiResult && (
        <div className="mt-6 card p-6">
          <AIResultDisplay
            title="Healthcare Nutrition Analysis"
            result={aiResult}
            type="healthcare"
          />
        </div>
      )}
    </div>
  );
}
