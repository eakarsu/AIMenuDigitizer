import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface SortOption {
  label: string;
  value: string;
}

interface Props {
  options: SortOption[];
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
  onSortChange: (sortBy: string, sortOrder: 'ASC' | 'DESC') => void;
}

export default function SortControls({ options, sortBy, sortOrder, onSortChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value, sortOrder)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <button
        onClick={() => onSortChange(sortBy, sortOrder === 'ASC' ? 'DESC' : 'ASC')}
        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        title={sortOrder === 'ASC' ? 'Sort Ascending' : 'Sort Descending'}
      >
        {sortOrder === 'ASC' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      </button>
    </div>
  );
}
