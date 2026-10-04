import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

type Item = { id: string; name: string; description?: string; price: number; available: boolean };
type Section = { name: string; items: Item[] };
type Menu = { restaurantRef: string; locationRef: string; menuRef: string; version: number; currency: string; sections: Section[]; reviewedLabels: { itemRef: string; type: string; name: string }[] };

export default function GovernedPublicWebMenu() {
  const { token } = useParams();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    axios.get(`/api/public-web-menu/${encodeURIComponent(token || '')}`)
      .then(response => { if (live) setMenu(response.data); })
      .catch(() => { if (live) setError('This menu is unavailable or has been withdrawn.'); });
    return () => { live = false; };
  }, [token]);
  if (error) return <main className="max-w-3xl mx-auto p-6"><h1 className="text-2xl font-bold">Menu unavailable</h1><p>{error}</p></main>;
  if (!menu) return <main className="max-w-3xl mx-auto p-6">Loading menu…</main>;
  const money = (amount: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: menu.currency }).format(amount);
  return <main className="max-w-3xl mx-auto p-6 space-y-6">
    <header><h1 className="text-3xl font-bold">{menu.restaurantRef}</h1><p>{menu.locationRef} · Menu version {menu.version}</p></header>
    {menu.sections.map(section => <section key={section.name}><h2 className="text-xl font-semibold border-b pb-2">{section.name}</h2><ul>{section.items.map(item => <li key={item.id} className="py-3 border-b"><div className="flex justify-between gap-4"><strong>{item.name}</strong><span>{money(Number(item.price))}</span></div>{item.description && <p>{item.description}</p>}<p className={item.available ? 'text-green-700' : 'text-red-700'}>{item.available ? 'Available at this location' : 'Currently unavailable at this location'}</p>{menu.reviewedLabels.filter(label => label.itemRef === item.id).map(label => <small key={`${label.type}:${label.name}`} className="block">{label.type}: {label.name} (reviewed source)</small>)}</li>)}</ul></section>)}
    <p className="text-sm text-gray-600">Ask staff about ingredients and allergies before ordering. This menu shows only reviewed labels recorded by the restaurant.</p>
  </main>;
}
