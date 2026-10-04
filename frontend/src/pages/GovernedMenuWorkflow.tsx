import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

type Ingestion = { ingestion_ref: string; source_type: string; object_ref: string; ocr_confidence: number; layout_kind?: string; correction_required: boolean; created_at: string };
type MenuVersion = { menu_ref: string; version: number; restaurant_ref: string; location_ref: string; channel: string; currency: string; status: string; source_ingestion_ref: string; normalized_menu?: unknown };
type Evidence = { labels: any[]; translations: any[]; audit: any[]; publications: any[] };
const emptyEvidence: Evidence = { labels: [], translations: [], audit: [], publications: [] };
const errorText = (error: any) => error.response?.data?.error || error.message || 'Request failed';
const blankSource = { ingestion_ref: '', source_type: 'image', source_checksum: '', object_ref: '', page_count: 1, deskew_angle: 0, ocr_confidence: 0, handwriting: false };
const blankVersion = { menu_ref: '', version: 1, restaurant_ref: '', location_ref: '', channel: 'web', currency: 'USD', source_ingestion_ref: '' };

function candidateToMenu(analysis: any, currency: string) {
  const groups = new Map<string, any[]>();
  for (const [index, item] of (Array.isArray(analysis?.items) ? analysis.items : []).entries()) {
    const category = String(item.category || 'Other');
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push({
      id: `item-${index + 1}`, name: String(item.name || ''), description: String(item.description || ''),
      price: item.price == null ? null : Number(item.price),
    });
  }
  return { currency, sections: Array.from(groups, ([name, items]) => ({ name, items })) };
}

export default function GovernedMenuWorkflow() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState('');
  const [ingestions, setIngestions] = useState<Ingestion[]>([]);
  const [versions, setVersions] = useState<MenuVersion[]>([]);
  const [selected, setSelected] = useState<MenuVersion | null>(null);
  const [evidence, setEvidence] = useState<Evidence>(emptyEvidence);
  const [source, setSource] = useState(blankSource);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const [uploadReference, setUploadReference] = useState('');
  const [version, setVersion] = useState(blankVersion);
  const [menuJson, setMenuJson] = useState(JSON.stringify({ currency: 'USD', sections: [] }, null, 2));
  const [availabilityJson, setAvailabilityJson] = useState('{}');
  const [sourceText, setSourceText] = useState('');
  const [reason, setReason] = useState('');
  const [labelForm, setLabelForm] = useState({ item_ref: '', label_type: 'allergen', label_name: '', evidence_ref: '', evidence_version: '', evidence_checksum: '' });
  const [translationForm, setTranslationForm] = useState({ locale: '', terminology_version: '', translated_menu: '{}', protected_names: '', round_trip_score: '' as number | string });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const get = (path: string, config: Record<string, unknown> = {}) => api.get(path, { ...config, headers: workspace ? { 'X-Menu-Workspace-Id': workspace } : {} });
  const post = (path: string, data: unknown) => api.post(path, data, { headers: workspace ? { 'X-Menu-Workspace-Id': workspace } : {} });

  async function load() {
    try {
      const [a, b] = await Promise.all([get('/api/menu-workflow/ingestions'), get('/api/menu-workflow/menus')]);
      setIngestions(Array.isArray(a.data.items) ? a.data.items : []);
      setVersions(Array.isArray(b.data.items) ? b.data.items : []);
      setError('');
    } catch (e) { setError(errorText(e)); }
  }

  useEffect(() => { api.get('/api/menu-workflow/workspaces').then(response => { const options = Array.isArray(response.data.items) ? response.data.items : []; setWorkspaces(options); setWorkspace(options[0] || ''); }).catch(e => setError(errorText(e))); }, []);
  useEffect(() => { setSelected(null); load(); }, [workspace]);

  async function select(item: MenuVersion) {
    setBusy(true); setError('');
    try {
      const path = `/api/menu-workflow/menus/${encodeURIComponent(item.menu_ref)}/versions/${item.version}`;
      const [a, b] = await Promise.all([get(path), get(`${path}/evidence`)]);
      setSelected(a.data);
      setEvidence(b.data);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function ingest(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await post('/api/menu-workflow/ingestions', { ...source, idempotency_key: crypto.randomUUID() });
      setVersion(current => ({ ...current, source_ingestion_ref: source.ingestion_ref }));
      setSource(blankSource);
      setNotice('Source metadata recorded. Correct the menu structure before creating a version.');
      await load();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function uploadSource(event: React.FormEvent) {
    event.preventDefault(); if (!sourceFile) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const body = new FormData(); body.append('source', sourceFile); body.append('ingestion_ref', uploadReference.trim()); body.append('idempotency_key', crypto.randomUUID());
      const response = await api.post('/api/menu-workflow/ingestions/upload', body, { headers: { 'Content-Type': undefined, ...(workspace ? { 'X-Menu-Workspace-Id': workspace } : {}) } });
      setVersion(current => ({ ...current, source_ingestion_ref: response.data.ingestion.ingestion_ref }));
      setSourceText(response.data.extractedText || '');
      setUploadReference(''); setSourceFile(null); if (sourceInputRef.current) sourceInputRef.current.value = '';
      setNotice(response.data.note || 'Stored source uploaded for manual correction.');
      await load();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function loadSourceText(reference: string) {
    setBusy(true); setError('');
    try { const response = await get(`/api/menu-workflow/ingestions/${encodeURIComponent(reference)}/text`); setSourceText(response.data.extractedText || ''); setVersion(current => ({ ...current, source_ingestion_ref: reference })); setNotice('Loaded stored source text; check it against the original file.'); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function extractScanText(reference: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await post(`/api/menu-workflow/ingestions/${encodeURIComponent(reference)}/scan-ocr`, {});
      setSourceText(response.data.extractedText || '');
      setVersion(current => ({ ...current, source_ingestion_ref: reference }));
      setNotice(`Scan OCR read ${response.data.pagesProcessed} page(s) and found ${response.data.wordCount} words at ${(Number(response.data.ocrConfidence) * 100).toFixed(0)}% mean word confidence. Check every menu field against the original scan.`);
      await load();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function downloadSource(reference: string) {
    setBusy(true); setError('');
    try {
      const response = await get(`/api/menu-workflow/ingestions/${encodeURIComponent(reference)}/source`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = `menu-source-${reference}`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function suggestStructure() {
    if (!sourceText.trim()) { setError('Enter text from the rights-cleared menu scan.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await post('/api/ai/analyze-text', { menuText: sourceText });
      const candidate = candidateToMenu(response.data.analysis, version.currency);
      setMenuJson(JSON.stringify(candidate, null, 2));
      setNotice('AI structure is a candidate. Check every name and price against the scan. Dietary or allergen claims were excluded because they need separate evidence.');
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function createVersion(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const normalized = JSON.parse(menuJson);
      normalized.currency = version.currency;
      const response = await post(`/api/menu-workflow/menus/${encodeURIComponent(version.menu_ref)}/versions`, {
        ...version, normalized_menu: normalized, availability: JSON.parse(availabilityJson),
      });
      setNotice('Corrected menu version saved. Independent evidence and translation review are required before approval.');
      await load();
      await select(response.data);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function transition(to: string) {
    if (!selected || !reason.trim()) { setError('Enter a specific reason for the transition.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await post(`/api/menu-workflow/menus/${encodeURIComponent(selected.menu_ref)}/versions/${selected.version}/transition`, {
        to, reason: reason.trim(), correlation_id: crypto.randomUUID(),
      });
      setNotice(`Menu version moved to ${to.replace(/_/g, ' ')}.`);
      setReason('');
      await load();
      await select(selected);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function publishWeb() {
    if (!selected || !reason.trim()) { setError('Enter a specific publication reason.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await post(`/api/menu-workflow/menus/${encodeURIComponent(selected.menu_ref)}/versions/${selected.version}/web-publish`, { reason: reason.trim() });
      setNotice(`Hosted web menu is live at ${response.data.publicPath}. Keep this path for the location's QR code.`);
      setReason(''); await load(); await select(selected);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function rollbackWeb() {
    if (!selected || !reason.trim()) { setError('Enter a specific rollback reason.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await post(`/api/menu-workflow/menus/${encodeURIComponent(selected.menu_ref)}/versions/${selected.version}/web-rollback`, { reason: reason.trim() });
      setNotice(response.data.restoredVersion == null ? 'Web menu withdrawn from public view.' : `Previous version ${response.data.restoredVersion} restored at ${response.data.publicPath}.`);
      setReason(''); await load(); await select(selected);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function saveLabel(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError('');
    try {
      await post(`/api/menu-workflow/menus/${encodeURIComponent(selected.menu_ref)}/versions/${selected.version}/labels`, labelForm);
      setNotice('Evidence label saved as pending. A separate reviewer must check its source.');
      await select(selected);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function saveTranslation(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError('');
    try {
      await post(`/api/menu-workflow/menus/${encodeURIComponent(selected.menu_ref)}/versions/${selected.version}/translations`, {
        ...translationForm,
        translated_menu: JSON.parse(translationForm.translated_menu),
        protected_names: translationForm.protected_names.split(',').map(value => value.trim()).filter(Boolean),
      });
      setNotice('Translation candidate saved as pending independent review.');
      await select(selected);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function reviewEvidence(kind: 'labels' | 'translations', id: number, decision: 'approved' | 'rejected') {
    if (!selected || !reason.trim()) { setError('Enter a review reason.'); return; }
    setBusy(true); setError('');
    try {
      await post(`/api/menu-workflow/menus/${encodeURIComponent(selected.menu_ref)}/versions/${selected.version}/${kind}/${id}/review`, { decision, reason: reason.trim() });
      setNotice('Independent review decision recorded.');
      setReason('');
      await select(selected);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  const approvalReady = evidence.labels.some(row => row.review_status === 'approved') && evidence.translations.some(row => row.review_status === 'approved');
  const publicationReady = evidence.publications.some(row => row.status === 'delivered' && row.provider_receipt && Number.isSafeInteger(Number(row.rollback_version)));
  const hostedReceipt = evidence.publications.find(row => row.channel === 'web' && row.status === 'delivered' && row.menu_version === selected?.version && /^webmenu:[0-9a-f-]{36}:v\d+$/.test(row.provider_receipt || ''));
  const hostedPath = hostedReceipt ? `/web-menu/${hostedReceipt.provider_receipt.split(':')[1]}` : '';
  const nextStates: Record<string, string[]> = {
    ingested: ['ocr_review'], ocr_review: ['structured'], structured: ['compliance_review'],
    compliance_review: ['structured', 'translation_review'], translation_review: ['compliance_review', 'approved'],
    approved: ['scheduled'], scheduled: ['published'], published: ['rolled_back'], rolled_back: ['scheduled'],
  };

  return <div className="max-w-7xl mx-auto p-6 space-y-6">
    <header><h1 className="text-2xl font-bold">Governed menu correction</h1><p className="text-gray-600">Record a source, correct an AI candidate, and inspect versioned review evidence. Publication requires a provider receipt and rollback version.</p></header>
    {workspaces.length > 0 && <label className="block">Menu workspace <select className="border rounded p-2 ml-2" value={workspace} onChange={e => setWorkspace(e.target.value)}>{workspaces.map(value => <option key={value}>{value}</option>)}</select></label>}
    {error && <p role="alert" className="p-3 rounded bg-red-100 text-red-800">{error}</p>}
    {notice && <p role="status" className="p-3 rounded bg-green-100 text-green-800">{notice}</p>}
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="bg-white rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold text-lg">Source evidence</h2>
        <form onSubmit={uploadSource} className="space-y-3 border rounded p-3">
          <h3 className="font-semibold">Upload original scan</h3>
          <label className="block">Source reference<input className="w-full border rounded p-2" required maxLength={180} value={uploadReference} onChange={e => setUploadReference(e.target.value)} /></label>
          <label className="block">PDF or menu image, up to 10 MB<input ref={sourceInputRef} className="w-full border rounded p-2" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required onChange={e => setSourceFile(e.target.files?.[0] || null)} /></label>
          <p className="text-sm text-gray-600">The server stores the bytes and computes their checksum. PDF text layers are extracted when present. Stored images and image-only PDFs of up to five pages can be sent through configured OCR for an unreviewed candidate.</p>
          <button className="bg-blue-700 text-white rounded px-4 py-2" disabled={busy || !sourceFile}>Store original source</button>
        </form>
        <h3 className="font-semibold">Register external source metadata</h3>
        <form onSubmit={ingest} className="space-y-3">
          <label className="block">Source reference<input className="w-full border rounded p-2" required value={source.ingestion_ref} onChange={e => setSource({ ...source, ingestion_ref: e.target.value })} /></label>
          <label className="block">Scan type<select className="w-full border rounded p-2" value={source.source_type} onChange={e => setSource({ ...source, source_type: e.target.value })}><option>image</option><option>pdf</option></select></label>
          <label className="block">Storage object reference<input className="w-full border rounded p-2" required value={source.object_ref} onChange={e => setSource({ ...source, object_ref: e.target.value })} /></label>
          <label className="block">Source SHA-256<input className="w-full border rounded p-2" required pattern="[a-fA-F0-9]{64}" value={source.source_checksum} onChange={e => setSource({ ...source, source_checksum: e.target.value })} /></label>
          <div className="grid grid-cols-3 gap-2"><label>Pages<input className="w-full border rounded p-2" type="number" min="1" value={source.page_count} onChange={e => setSource({ ...source, page_count: Number(e.target.value) })} /></label><label>Deskew angle<input className="w-full border rounded p-2" type="number" step="0.01" value={source.deskew_angle} onChange={e => setSource({ ...source, deskew_angle: Number(e.target.value) })} /></label><label>OCR confidence<input className="w-full border rounded p-2" type="number" min="0" max="1" step="0.01" value={source.ocr_confidence} onChange={e => setSource({ ...source, ocr_confidence: Number(e.target.value) })} /></label></div>
          <label className="block"><input type="checkbox" checked={source.handwriting} onChange={e => setSource({ ...source, handwriting: e.target.checked })} /> Handwriting present</label>
          <button className="bg-blue-700 text-white rounded px-4 py-2" disabled={busy}>Record source metadata</button>
        </form>
        <h3 className="font-semibold">Recent ingestions</h3>
        <ul className="space-y-1">{ingestions.map(item => <li key={item.ingestion_ref} className="text-sm">{item.ingestion_ref} · {item.source_type} · {item.correction_required ? 'correction required' : 'review required'} {item.layout_kind?.endsWith('_ocr_candidate') && ` · OCR ${(Number(item.ocr_confidence) * 100).toFixed(0)}%`} {item.object_ref.startsWith('db-source:') && <><button className="text-blue-700 underline mx-2" disabled={busy} onClick={() => loadSourceText(item.ingestion_ref)}>Load text</button>{(item.source_type === 'image' || (item.source_type === 'pdf' && item.layout_kind !== 'pdf_text_layer')) && <button className="text-blue-700 underline mr-2" disabled={busy} onClick={() => extractScanText(item.ingestion_ref)}>Extract scan text</button>}<button className="text-blue-700 underline" disabled={busy} onClick={() => downloadSource(item.ingestion_ref)}>Download original</button></>}</li>)}</ul>
      </section>
      <section className="bg-white rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold text-lg">Corrected menu version</h2>
        <form onSubmit={createVersion} className="space-y-3">
          <div className="grid grid-cols-2 gap-2"><label>Menu reference<input className="w-full border rounded p-2" required value={version.menu_ref} onChange={e => setVersion({ ...version, menu_ref: e.target.value })} /></label><label>Version<input className="w-full border rounded p-2" type="number" min="1" required value={version.version} onChange={e => setVersion({ ...version, version: Number(e.target.value) })} /></label></div>
          <div className="grid grid-cols-2 gap-2"><label>Restaurant reference<input className="w-full border rounded p-2" required value={version.restaurant_ref} onChange={e => setVersion({ ...version, restaurant_ref: e.target.value })} /></label><label>Location reference<input className="w-full border rounded p-2" required value={version.location_ref} onChange={e => setVersion({ ...version, location_ref: e.target.value })} /></label></div>
          <div className="grid grid-cols-3 gap-2"><label>Channel<input className="w-full border rounded p-2" required value={version.channel} onChange={e => setVersion({ ...version, channel: e.target.value })} /></label><label>Currency<input className="w-full border rounded p-2" required pattern="[A-Z]{3}" value={version.currency} onChange={e => setVersion({ ...version, currency: e.target.value.toUpperCase() })} /></label><label>Source<select className="w-full border rounded p-2" required value={version.source_ingestion_ref} onChange={e => setVersion({ ...version, source_ingestion_ref: e.target.value })}><option value="">Select source</option>{ingestions.map(item => <option key={item.ingestion_ref}>{item.ingestion_ref}</option>)}</select></label></div>
          <label className="block">Rights-cleared scan text<textarea className="w-full border rounded p-2" rows={4} value={sourceText} onChange={e => setSourceText(e.target.value)} /></label>
          <button type="button" className="bg-indigo-100 text-indigo-900 rounded px-3 py-2" disabled={busy} onClick={suggestStructure}>Suggest AI structure</button>
          <label className="block">Corrected menu JSON<textarea className="w-full border rounded p-2 font-mono text-sm" rows={14} required value={menuJson} onChange={e => setMenuJson(e.target.value)} /></label>
          <label className="block">Location availability by item ID (JSON booleans)<textarea className="w-full border rounded p-2 font-mono text-sm" rows={3} required value={availabilityJson} onChange={e => setAvailabilityJson(e.target.value)} placeholder={'{"item-1":true,"item-2":false}'} /></label>
          <p className="text-sm text-gray-600">Use sections with items containing unique id, name, and price. Check every price manually; the AI candidate excludes safety labels.</p>
          <button className="bg-blue-700 text-white rounded px-4 py-2" disabled={busy}>Save corrected version</button>
        </form>
      </section>
    </div>
    <section className="bg-white rounded-lg border p-4"><h2 className="font-semibold text-lg">Menu versions</h2><div className="flex flex-wrap gap-2 mt-2">{versions.map(item => <button key={`${item.menu_ref}:${item.version}`} className="border rounded px-3 py-2" onClick={() => select(item)}>{item.menu_ref} v{item.version} · {item.status}</button>)}</div>{!versions.length && <p>No governed menu versions yet.</p>}</section>
    {selected && <section className="bg-white rounded-lg border p-4 space-y-3"><h2 className="font-semibold text-lg">{selected.menu_ref} v{selected.version}</h2><p>Status: {selected.status} · Source: {selected.source_ingestion_ref}</p><pre className="overflow-auto bg-gray-50 p-3 text-xs">{JSON.stringify(selected.normalized_menu, null, 2)}</pre><h3 className="font-semibold">Evidence and publication</h3>
      <form onSubmit={saveLabel} className="grid md:grid-cols-2 gap-2 border rounded p-3">
        <h4 className="md:col-span-2 font-semibold">Source-backed label</h4>
        <label>Item reference<input className="w-full border rounded p-2" required value={labelForm.item_ref} onChange={e => setLabelForm({ ...labelForm, item_ref: e.target.value })} /></label>
        <label>Label type<select className="w-full border rounded p-2" value={labelForm.label_type} onChange={e => setLabelForm({ ...labelForm, label_type: e.target.value })}>{['allergen','ingredient','nutrition','dietary'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Label name<input className="w-full border rounded p-2" required value={labelForm.label_name} onChange={e => setLabelForm({ ...labelForm, label_name: e.target.value })} /></label>
        <label>Evidence reference<input className="w-full border rounded p-2" required value={labelForm.evidence_ref} onChange={e => setLabelForm({ ...labelForm, evidence_ref: e.target.value })} /></label>
        <label>Evidence version<input className="w-full border rounded p-2" required value={labelForm.evidence_version} onChange={e => setLabelForm({ ...labelForm, evidence_version: e.target.value })} /></label>
        <label>Evidence SHA-256<input className="w-full border rounded p-2" required pattern="[a-fA-F0-9]{64}" value={labelForm.evidence_checksum} onChange={e => setLabelForm({ ...labelForm, evidence_checksum: e.target.value })} /></label>
        <button className="border rounded px-3 py-2" disabled={busy}>Add pending label</button>
      </form>
      <form onSubmit={saveTranslation} className="grid md:grid-cols-2 gap-2 border rounded p-3">
        <h4 className="md:col-span-2 font-semibold">Translation candidate</h4>
        <label>Locale<input className="w-full border rounded p-2" required value={translationForm.locale} onChange={e => setTranslationForm({ ...translationForm, locale: e.target.value })} /></label>
        <label>Terminology version<input className="w-full border rounded p-2" required value={translationForm.terminology_version} onChange={e => setTranslationForm({ ...translationForm, terminology_version: e.target.value })} /></label>
        <label className="md:col-span-2">Translated name map JSON<textarea className="w-full border rounded p-2 font-mono" required value={translationForm.translated_menu} onChange={e => setTranslationForm({ ...translationForm, translated_menu: e.target.value })} /></label>
        <label>Protected dish names, comma separated<input className="w-full border rounded p-2" value={translationForm.protected_names} onChange={e => setTranslationForm({ ...translationForm, protected_names: e.target.value })} /></label>
        <label>Round-trip score<input className="w-full border rounded p-2" type="number" min="0.9" max="1" step="0.01" required value={translationForm.round_trip_score} onChange={e => setTranslationForm({ ...translationForm, round_trip_score: Number(e.target.value) })} /></label>
        <button className="border rounded px-3 py-2" disabled={busy}>Add pending translation</button>
      </form>
      <div className="space-y-2"><h4 className="font-semibold">Independent review</h4>
        {evidence.labels.map(row => <p key={`label:${row.id}`} className="text-sm">{row.item_ref}: {row.label_name} · {row.review_status} {row.review_status === 'pending' && <><button className="border rounded px-2 mx-1" disabled={busy || !reason.trim()} onClick={() => reviewEvidence('labels', row.id, 'approved')}>Approve</button><button className="border rounded px-2" disabled={busy || !reason.trim()} onClick={() => reviewEvidence('labels', row.id, 'rejected')}>Reject</button></>}</p>)}
        {evidence.translations.map(row => <p key={`translation:${row.id}`} className="text-sm">{row.locale}: {row.review_status} {row.review_status === 'pending' && <><button className="border rounded px-2 mx-1" disabled={busy || !reason.trim()} onClick={() => reviewEvidence('translations', row.id, 'approved')}>Approve</button><button className="border rounded px-2" disabled={busy || !reason.trim()} onClick={() => reviewEvidence('translations', row.id, 'rejected')}>Reject</button></>}</p>)}
      </div><p>{evidence.labels.length} safety/ingredient labels · {evidence.translations.length} translations · {evidence.publications.length} publication records</p>{hostedPath && <p className="text-sm">Hosted menu: <a className="text-blue-700 underline" href={hostedPath} target="_blank" rel="noopener noreferrer">{hostedPath}</a></p>}<ul className="text-sm">{evidence.audit.map(row => <li key={row.id}>{row.to_status}: {row.reason}</li>)}</ul><label className="block">Transition reason<textarea className="w-full border rounded p-2" value={reason} onChange={e => setReason(e.target.value)} /></label><div className="flex flex-wrap gap-2">{(nextStates[selected.status] || []).map(to => <button key={to} className="border rounded px-3 py-2" disabled={busy || !reason.trim() || (to === 'approved' && !approvalReady) || (to === 'published' && selected.channel !== 'web' && !publicationReady)} onClick={() => to === 'published' && selected.channel === 'web' ? publishWeb() : to === 'rolled_back' && selected.channel === 'web' ? rollbackWeb() : transition(to)}>{to === 'published' && selected.channel === 'web' ? 'Publish hosted web menu' : to === 'rolled_back' && selected.channel === 'web' ? 'Roll back hosted web menu' : to === 'published' ? 'Record provider publication' : `Move to ${to.replace(/_/g, ' ')}`}</button>)}</div><p className="text-sm text-gray-600">Approval is blocked until independent evidence and translation review. Web publishing gives a location a stable public URL with a recorded version and rollback path. Other channels require their own provider receipt.</p></section>}
  </div>;
}
