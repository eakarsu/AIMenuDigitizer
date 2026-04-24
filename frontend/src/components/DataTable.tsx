import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
}

interface Props {
  columns: Column[];
  data: any[];
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  onRowClick?: (row: any) => void;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  onSort?: (field: string) => void;
  idKey?: string;
}

export default function DataTable({
  columns,
  data,
  selectedIds,
  onSelectionChange,
  onRowClick,
  sortBy,
  sortOrder,
  onSort,
  idKey = 'id',
}: Props) {
  const allSelected = data.length > 0 && data.every(row => selectedIds.has(row[idKey]));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map(row => row[idKey])));
    }
  };

  const toggleRow = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortOrder === 'ASC'
      ? <ArrowUp className="h-3 w-3 text-primary-500" />
      : <ArrowDown className="h-3 w-3 text-primary-500" />;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`text-left px-4 py-3 text-sm font-medium text-gray-600 ${col.sortable ? 'cursor-pointer hover:text-gray-900' : ''} ${col.className || ''}`}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && <SortIcon field={col.key} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map(row => (
              <tr
                key={row[idKey]}
                className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${
                  selectedIds.has(row[idKey]) ? 'bg-primary-50' : ''
                }`}
                onClick={() => onRowClick?.(row)}
              >
                <td className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row[idKey])}
                    onChange={() => {}}
                    onClick={(e) => toggleRow(row[idKey], e)}
                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                </td>
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
