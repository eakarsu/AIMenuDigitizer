import { useEffect, useState } from 'react';
import { ingredientsApi } from '../services/api';
import { DollarSign } from 'lucide-react';

export default function IngredientCostsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', unit: 'g', cost_per_unit: '', vendor: '' });
  const [analysisMenuId, setAnalysisMenuId] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    try { const r = await ingredientsApi.list(); setItems(r.data.ingredients || []); }
    catch (e: any) { setError(e.response?.data?.error || 'Load failed'); }
  };
  useEffect(() => { refresh(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await ingredientsApi.create({ name: form.name, unit: form.unit, cost_per_unit: parseFloat(form.cost_per_unit), vendor: form.vendor || undefined });
      setForm({ name: '', unit: 'g', cost_per_unit: '', vendor: '' }); refresh(); }
    catch (e: any) { setError(e.response?.data?.error || 'Create failed'); }
  };

  const runAnalysis = async () => {
    try { const r = await ingredientsApi.analysis(parseInt(analysisMenuId, 10)); setAnalysis(r.data); }
    catch (e: any) { setError(e.response?.data?.error || 'Analysis failed'); }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4"><DollarSign className="w-5 h-5" /> Ingredient Costs</h1>
      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-3">{error}</div>}
      <form onSubmit={create} className="grid grid-cols-4 gap-2 mb-4">
        <input placeholder="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border rounded px-2 py-1" required />
        <input placeholder="unit (g/oz/each)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="border rounded px-2 py-1" required />
        <input type="number" step="0.0001" placeholder="cost per unit" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} className="border rounded px-2 py-1" required />
        <input placeholder="vendor (optional)" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className="border rounded px-2 py-1" />
        <button type="submit" className="col-span-4 bg-blue-600 text-white py-1 rounded">Add ingredient</button>
      </form>
      <ul className="space-y-1 mb-6">
        {items.map((i) => <li key={i.id} className="text-sm border-b py-1">{i.name} ({i.unit}) @ {i.cost_per_unit}</li>)}
      </ul>
      <h2 className="font-semibold mb-2">Cost Analysis (per menu)</h2>
      <div className="flex gap-2 mb-2">
        <input type="number" placeholder="menu id" value={analysisMenuId} onChange={(e) => setAnalysisMenuId(e.target.value)} className="border rounded px-2 py-1" />
        <button onClick={runAnalysis} className="bg-green-600 text-white px-3 py-1 rounded">Run analysis</button>
      </div>
      {analysis && <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">{JSON.stringify(analysis, null, 2)}</pre>}
    </div>
  );
}
