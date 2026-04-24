interface Props {
  allergen: {
    id: number;
    name: string;
    severity: string;
    description: string;
    item_name: string;
    category: string;
    created_at?: string;
  };
}

export default function AllergenDetail({ allergen }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Menu Item</label>
        <p className="font-medium text-gray-900">{allergen.item_name}</p>
        <p className="text-sm text-gray-500">{allergen.category}</p>
      </div>
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Allergen</label>
        <p className="font-medium text-gray-900">{allergen.name}</p>
      </div>
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Severity</label>
        <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${
          allergen.severity === 'high' ? 'bg-red-100 text-red-800' :
          allergen.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {allergen.severity}
        </span>
      </div>
      {allergen.description && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Description</label>
          <p className="text-gray-700 mt-1">{allergen.description}</p>
        </div>
      )}
      {allergen.created_at && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Added</label>
          <p className="text-gray-600 text-sm">{new Date(allergen.created_at).toLocaleDateString()}</p>
        </div>
      )}
    </div>
  );
}
