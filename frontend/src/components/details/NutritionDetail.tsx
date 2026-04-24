interface Props {
  nutrition: {
    id: number;
    item_name: string;
    category: string;
    calories: number;
    protein: string;
    carbohydrates: string;
    fat: string;
    fiber: string;
    sodium: string;
    sugar: string;
    serving_size: string;
    price?: string;
  };
}

export default function NutritionDetail({ nutrition }: Props) {
  const macros = [
    { label: 'Protein', value: `${nutrition.protein}g`, color: 'text-blue-600' },
    { label: 'Carbs', value: `${nutrition.carbohydrates}g`, color: 'text-orange-600' },
    { label: 'Fat', value: `${nutrition.fat}g`, color: 'text-yellow-600' },
    { label: 'Fiber', value: `${nutrition.fiber}g`, color: 'text-green-600' },
    { label: 'Sugar', value: `${nutrition.sugar}g`, color: 'text-pink-600' },
    { label: 'Sodium', value: `${nutrition.sodium}mg`, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Menu Item</label>
        <p className="font-medium text-gray-900">{nutrition.item_name}</p>
        <p className="text-sm text-gray-500">{nutrition.category}</p>
      </div>

      <div className="text-center p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl">
        <div className="text-4xl font-bold text-orange-600">{nutrition.calories}</div>
        <div className="text-sm text-gray-600">calories</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {macros.map(m => (
          <div key={m.label} className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">{m.label}</div>
            <div className={`font-semibold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {nutrition.serving_size && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Serving Size</label>
          <p className="text-gray-700">{nutrition.serving_size}</p>
        </div>
      )}

      {nutrition.price && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Price</label>
          <p className="text-green-600 font-semibold">${parseFloat(nutrition.price).toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
