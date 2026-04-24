import { Trash2, Edit, X } from 'lucide-react';

interface Props {
  selectedCount: number;
  onDelete: () => void;
  onClear: () => void;
  entityName?: string;
}

export default function BulkActionBar({ selectedCount, onDelete, onClear, entityName = 'items' }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-10 bg-primary-600 text-white rounded-xl p-3 mb-4 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
          {selectedCount} {entityName} selected
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Delete Selected
        </button>
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      </div>
    </div>
  );
}
