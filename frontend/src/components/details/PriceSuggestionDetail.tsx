interface Props {
  suggestion: {
    id: number;
    item_name: string;
    category: string;
    current_price: number;
    suggested_price: number;
    min_price: number;
    max_price: number;
    confidence: number;
    reasoning: string;
    demand_level: string;
    created_at: string;
  };
}

export default function PriceSuggestionDetail({ suggestion }: Props) {
  const diff = suggestion.suggested_price - suggestion.current_price;
  const pct = ((diff / suggestion.current_price) * 100).toFixed(1);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Item</label>
        <p className="font-medium text-gray-900">{suggestion.item_name}</p>
        <p className="text-sm text-gray-500">{suggestion.category}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 bg-gray-50 rounded-xl">
          <div className="text-xs text-gray-500">Current</div>
          <div className="text-lg font-bold text-gray-700">${suggestion.current_price?.toFixed(2)}</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-xl border-2 border-green-200">
          <div className="text-xs text-green-600">Suggested</div>
          <div className="text-lg font-bold text-green-700">${suggestion.suggested_price?.toFixed(2)}</div>
          <div className={`text-xs font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {diff >= 0 ? '+' : ''}{pct}%
          </div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-xl">
          <div className="text-xs text-gray-500">Range</div>
          <div className="text-sm font-bold text-gray-700">
            ${suggestion.min_price?.toFixed(2)}-${suggestion.max_price?.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500">Confidence</div>
          <div className="font-bold text-gray-900">{suggestion.confidence}%</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500">Demand</div>
          <div className={`font-bold ${
            suggestion.demand_level === 'High' ? 'text-green-600' :
            suggestion.demand_level === 'Medium' ? 'text-yellow-600' : 'text-red-600'
          }`}>{suggestion.demand_level}</div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-xl">
        <div className="text-xs font-medium text-blue-700 mb-1">Analysis</div>
        <p className="text-sm text-blue-900">{suggestion.reasoning}</p>
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Analyzed</label>
        <p className="text-gray-600 text-sm">{new Date(suggestion.created_at).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
