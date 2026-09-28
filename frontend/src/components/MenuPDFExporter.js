import React, { useEffect, useState } from 'react';

// MenuPDFExporter — picks one of the user's real menus plus a style and paper
// size, then triggers a PDF download from POST /api/custom-views/menu-pdf.

function authHeaders() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const STYLES = ['Classic', 'Modern', 'Minimalist'];
const PAPERS = ['A4', 'Letter'];

const STYLE_PREVIEW = {
  Classic:    { font: 'Georgia, "Times New Roman", serif', accent: '#7c2d12', bg: '#fef7ed' },
  Modern:     { font: 'system-ui, -apple-system, sans-serif',  accent: '#0ea5e9', bg: '#f0f9ff' },
  Minimalist: { font: 'system-ui, -apple-system, sans-serif',  accent: '#111827', bg: '#f9fafb' },
};

export default function MenuPDFExporter() {
  const [menus, setMenus] = useState([]);
  const [menuId, setMenuId] = useState('');
  const [style, setStyle] = useState('Classic');
  const [paper, setPaper] = useState('A4');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/custom-views/menus', {
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!cancelled) {
          const list = data.menus || [];
          setMenus(list);
          if (list[0]) setMenuId(String(list[0].id));
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleExport() {
    setError(null);
    setDownloading(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/custom-views/menu-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ menuId: Number(menuId), style, paper }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const sizeKB = Math.round(blob.size / 1024);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fname = `menu-${menuId || 'export'}-${style.toLowerCase()}-${paper.toLowerCase()}.pdf`;
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 500);
      setLastResult({ filename: fname, sizeKB });
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  const preview = STYLE_PREVIEW[style];
  const selectedMenu = menus.find((m) => String(m.id) === String(menuId));
  const previewItems = (selectedMenu?.items || []).slice(0, 3);

  return (
    <div data-testid="menu-pdf-exporter" style={{
      background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16,
    }}>
      {loading ? (
        <div style={{ color: '#6b7280' }}>Loading menus…</div>
      ) : menus.length === 0 ? (
        <div data-testid="pdf-empty" style={{ color: '#6b7280', fontSize: 13 }}>
          No menus available. Create a menu with items first, then export it here.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Menu</span>
              <select
                data-testid="pdf-menu"
                value={menuId}
                onChange={(e) => setMenuId(e.target.value)}
                style={{
                  padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6,
                  background: '#fff', fontSize: 14,
                }}
              >
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.restaurant_name ? ` — ${m.restaurant_name}` : ''} ({m.item_count} items)
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Style</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    data-testid={`style-${s.toLowerCase()}`}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: `1px solid ${style === s ? STYLE_PREVIEW[s].accent : '#d1d5db'}`,
                      background: style === s ? STYLE_PREVIEW[s].bg : '#fff',
                      color: style === s ? STYLE_PREVIEW[s].accent : '#374151',
                      fontWeight: style === s ? 700 : 500,
                      cursor: 'pointer', fontSize: 13,
                    }}
                  >{s}</button>
                ))}
              </div>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Paper Size</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {PAPERS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPaper(p)}
                    data-testid={`paper-${p.toLowerCase()}`}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: `1px solid ${paper === p ? '#6366f1' : '#d1d5db'}`,
                      background: paper === p ? '#eef2ff' : '#fff',
                      color: paper === p ? '#4338ca' : '#374151',
                      fontWeight: paper === p ? 700 : 500,
                      cursor: 'pointer', fontSize: 13,
                    }}
                  >{p}</button>
                ))}
              </div>
            </label>

            <button
              onClick={handleExport}
              disabled={downloading || !menuId || (selectedMenu?.item_count || 0) === 0}
              data-testid="export-pdf-btn"
              style={{
                marginTop: 4,
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: downloading ? '#9ca3af' : '#4f46e5',
                color: '#fff',
                fontWeight: 700,
                cursor: downloading ? 'wait' : 'pointer',
                fontSize: 14,
              }}
            >
              {downloading ? 'Generating PDF…' : 'Export Menu PDF'}
            </button>

            {error && (
              <div style={{ color: '#b91c1c', fontSize: 12 }}>Error: {error}</div>
            )}
            {lastResult && (
              <div data-testid="pdf-result" style={{
                background: '#ecfdf5', color: '#065f46', borderRadius: 6,
                padding: '8px 10px', fontSize: 12,
              }}>
                Downloaded <strong>{lastResult.filename}</strong> ({lastResult.sizeKB} KB)
              </div>
            )}
          </div>

          {/* Preview pane — real items from the selected menu */}
          <div style={{
            background: preview.bg,
            border: `1px solid ${preview.accent}33`,
            borderRadius: 8,
            padding: 16,
            fontFamily: preview.font,
            minHeight: 220,
          }}>
            <div style={{
              fontSize: 18, fontWeight: 700, color: preview.accent, textAlign: 'center',
            }}>
              {selectedMenu ? (selectedMenu.restaurant_name || selectedMenu.name) : 'Menu'}
            </div>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {style} · {paper}
            </div>
            <div style={{
              borderTop: `1px solid ${preview.accent}55`,
              margin: '10px 0',
            }} />
            {previewItems.length === 0 ? (
              <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 24 }}>
                This menu has no items yet.
              </div>
            ) : (
              previewItems.map((item) => (
                <div key={item.id} style={{ marginBottom: 10, color: '#111827', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <span style={{ fontWeight: 700, color: preview.accent }}>
                      {item.price != null ? `$${Number(item.price).toFixed(2)}` : ''}
                    </span>
                  </div>
                  {item.description && (
                    <div style={{ color: '#6b7280', fontSize: 11, fontStyle: style === 'Classic' ? 'italic' : 'normal' }}>
                      {item.description}
                    </div>
                  )}
                </div>
              ))
            )}
            {selectedMenu && selectedMenu.item_count > previewItems.length && (
              <div style={{ marginTop: 6, fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
                Preview shows {previewItems.length} of {selectedMenu.item_count} items.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
