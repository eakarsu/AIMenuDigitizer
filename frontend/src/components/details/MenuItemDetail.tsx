interface Props {
  item: {
    id: number;
    name: string;
    description: string;
    price: number;
    category: string;
    is_vegetarian: boolean;
    is_vegan: boolean;
    is_gluten_free: boolean;
    spice_level: number;
    created_at?: string;
  };
}

export default function MenuItemDetail({ item }: Props) {
  const tags = [
    ...(item.is_vegetarian ? ['Vegetarian'] : []),
    ...(item.is_vegan ? ['Vegan'] : []),
    ...(item.is_gluten_free ? ['Gluten-Free'] : []),
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Name</label>
        <p className="text-lg font-bold text-gray-900">{item.name}</p>
      </div>
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Category</label>
        <p className="text-gray-600">{item.category}</p>
      </div>
      {item.description && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Description</label>
          <p className="text-gray-700 mt-1">{item.description}</p>
        </div>
      )}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Price</label>
        <p className="text-2xl font-bold text-green-600">${item.price?.toFixed(2)}</p>
      </div>
      {item.spice_level > 0 && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Spice Level</label>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`text-lg ${i < item.spice_level ? '' : 'opacity-20'}`}>
                🌶️
              </span>
            ))}
          </div>
        </div>
      )}
      {tags.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Dietary Tags</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {tags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
