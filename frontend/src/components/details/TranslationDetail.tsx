import { Globe } from 'lucide-react';

interface Props {
  translation: {
    id: number;
    original_name: string;
    original_description?: string;
    language_code: string;
    language_name: string;
    translated_name: string;
    translated_description?: string;
    category?: string;
  };
}

export default function TranslationDetail({ translation }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-blue-500" />
        <span className="font-medium text-blue-700">{translation.language_name}</span>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{translation.language_code}</span>
      </div>

      {translation.category && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Category</label>
          <p className="text-gray-600">{translation.category}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div className="p-4 bg-gray-50 rounded-xl">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Original</label>
          <p className="font-medium text-gray-900 mt-1">{translation.original_name}</p>
          {translation.original_description && (
            <p className="text-sm text-gray-600 mt-1">{translation.original_description}</p>
          )}
        </div>
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <label className="text-xs text-blue-600 uppercase tracking-wide">Translated</label>
          <p className="font-medium text-blue-800 mt-1">{translation.translated_name}</p>
          {translation.translated_description && (
            <p className="text-sm text-blue-700 mt-1">{translation.translated_description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
