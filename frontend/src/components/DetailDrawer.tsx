import { X, Edit, Trash2 } from 'lucide-react';
import { ReactNode } from 'react';

interface Props {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function DetailDrawer({ isOpen, title, children, onClose, onEdit, onDelete }: Props) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer */}
        {(onEdit || onDelete) && (
          <div className="border-t border-gray-200 p-4 flex gap-3">
            {onEdit && (
              <button onClick={onEdit} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Edit className="h-4 w-4" /> Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
