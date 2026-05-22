import { useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

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
        </div>
      )}
    </div>
  );
}
