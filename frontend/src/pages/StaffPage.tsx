import { useEffect, useState } from 'react';
import { staffApi } from '../services/api';
import { Users } from 'lucide-react';

export default function StaffPage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [assignments, setAssignments] = useState<any[]>([]);
  const [form, setForm] = useState({ user_id: '', location_id: '', role: 'manager' });
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      const [r1, r2] = await Promise.all([staffApi.roles(), staffApi.assignments()]);
      setRoles(r1.data.roles || []); setPermissions(r1.data.permissions || {});
      setAssignments(r2.data.assignments || []);
    } catch (e: any) { setError(e.response?.data?.error || 'Load failed'); }
  };
  useEffect(() => { refresh(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await staffApi.assign({ user_id: parseInt(form.user_id, 10), location_id: form.location_id ? parseInt(form.location_id, 10) : undefined, role: form.role });
      setForm({ user_id: '', location_id: '', role: 'manager' });
      refresh();
    } catch (e: any) { setError(e.response?.data?.error || 'Assign failed'); }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-4"><Users className="w-5 h-5" /> Staff & Permissions</h1>
      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-3">{error}</div>}
      <h2 className="font-semibold mb-2">Role permissions</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {roles.map((r) => (
          <div key={r} className="border rounded p-3">
            <strong className="capitalize">{r}</strong>
            <ul className="text-sm text-gray-600 mt-1">{(permissions[r] || []).map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        ))}
      </div>
      <h2 className="font-semibold mb-2">Assignments</h2>
      <form onSubmit={submit} className="flex gap-2 mb-3">
        <input type="number" placeholder="user id" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} className="border rounded px-2 py-1" required />
        <input type="number" placeholder="location id (optional)" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} className="border rounded px-2 py-1" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="border rounded px-2 py-1">
          {roles.map((r) => <option key={r}>{r}</option>)}
        </select>
        <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded">Assign</button>
      </form>
      <ul className="space-y-1">
        {assignments.map((a) => (
          <li key={a.id} className="text-sm border-b py-1">user {a.user_id} ({a.staff_email || '?'}) @ loc {a.location_id ?? '—'} → <strong>{a.role}</strong></li>
        ))}
      </ul>
    </div>
  );
}
