import { useState } from 'react';
import AIPresetButtons from '../components/AIPresetButtons';
import FormattedAIReport from '../components/FormattedAIReport';

const API = '/api';

const REPRICE_PRESETS = [
  { name: 'Casual dining', values: 'Burger,4.25,14,120\nSalad,3.10,12,80\nPasta,5.40,17,65' },
  { name: 'Cafe menu', values: 'Avocado Toast,3.60,13,95\nChicken Panini,4.80,15,72\nBerry Parfait,2.35,9,58' },
  { name: 'Dinner service', values: 'Grilled Salmon,9.75,29,46\nShort Rib,11.20,32,38\nMushroom Risotto,6.40,22,54' },
];

export default function PlateMarginRepricePage() {
  const [items, setItems] = useState('Burger,4.25,14,120\nSalad,3.1,12,80\nPasta,5.4,17,65');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    setError('');
    const menuItems = items.split('\n').map((line) => {
      const [name, ingredientCost, currentPrice, weeklySales] = line.split(',').map((v) => v.trim());
      return { name, ingredientCost: Number(ingredientCost), currentPrice: Number(currentPrice), weeklySales: Number(weeklySales) };
    }).filter((item) => item.name);
    try {
      const res = await fetch(`${API}/plate-margin-reprice/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItems }),
      });
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Plate Margin Reprice</h1>
      <p className="text-gray-600 mb-4">Find menu items where ingredient, labor, and waste assumptions require pricing action.</p>
      <AIPresetButtons presets={REPRICE_PRESETS} onSelect={setItems} />
      <label className="block text-sm font-medium text-gray-700 mb-1">Menu items (name, ingredient cost, current price, weekly sales)</label>
      <textarea className="w-full border rounded p-3 h-40" value={items} onChange={(e) => setItems(e.target.value)} />
      <button className="mt-3 px-4 py-2 bg-primary-600 text-white rounded" onClick={analyze}>Analyze pricing</button>
      {error && <div className="mt-3 text-red-600">{error}</div>}
      {result && (
        <div className="mt-6 bg-white border rounded-lg p-4">
          <div className="font-semibold">Portfolio weekly margin gap: ${result.portfolioGap}</div>
          <div className="mt-4 grid gap-3">
            {result.recommendations.map((item: any) => (
              <div key={item.name} className="border rounded p-3">
                <div className="font-medium">{item.name} - {item.action}</div>
                <div className="text-sm text-gray-600">Current ${item.currentPrice} to Target ${item.targetPrice}; weekly gap ${item.marginGap}</div>
              </div>
            ))}
          </div>
          <details className="mt-4 border-t pt-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-600">Complete structured result</summary>
            <FormattedAIReport response={result} title="Plate margin reprice" />
          </details>
        </div>
      )}
    </div>
  );
}
