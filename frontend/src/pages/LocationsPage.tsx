import { useEffect, useState } from 'react';
import { locationsApi } from '../services/api';
import { MapPin } from 'lucide-react';

export default function LocationsPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    try { const r = await locationsApi.list(); setLocations(r.data.locations || []); }
    catch (e: any) { setError(e.response?.data?.error || 'Load failed'); }
  };
  useEffect(() => { refresh(); }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await locationsApi.create({ name }); setName(''); refresh(); }
    catch (e: any) { setError(e.response?.data?.error || 'Create failed'); }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4"><MapPin className="w-5 h-5" /> Locations</h1>
      <p className="text-gray-500 mb-4">Manage multiple restaurant locations.</p>
      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-3">{error}</div>}
      <form onSubmit={onCreate} className="flex gap-2 mb-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Location name" className="border rounded px-3 py-2 flex-1" required />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>
      </form>
      <ul className="space-y-2">
        {locations.map((l) => (
          <li key={l.id} className="border rounded p-3"><strong>{l.name}</strong> <span className="text-gray-500 text-sm">{l.city || ''}</span></li>
        ))}
      </ul>
    </div>
  );
}
