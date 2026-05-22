import React, { useEffect, useState } from 'react';

// MenuPDFExporter — picks a restaurant + style + paper size and triggers a PDF download
// from POST /api/custom-views/menu-pdf (binary response).

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
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState('');
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
        const res = await fetch('/api/custom-views/restaurants', {
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setRestaurants(data.restaurants || []);
          if (data.restaurants && data.restaurants[0]) setRestaurantId(data.restaurants[0].id);
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
        body: JSON.stringify({ restaurantId, style, paper }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const sizeKB = Math.round(blob.size / 1024);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const r = restaurants.find((x) => x.id === restaurantId);
      const fname = `menu-${r ? r.id : 'restaurant'}-${style.toLowerCase()}-${paper.toLowerCase()}.pdf`;
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
  const selectedRestaurant = restaurants.find((r) => r.id === restaurantId);

  return (
    <div data-testid="menu-pdf-exporter" style={{
      background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16,
    }}>
      {loading ? (
        <div style={{ color: '#6b7280' }}>Loading restaurants…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Restaurant</span>
              <select
                data-testid="pdf-restaurant"
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                style={{
                  padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6,
                  background: '#fff', fontSize: 14,
                }}
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} — {r.cuisine}</option>
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
              disabled={downloading || !restaurantId}
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

          {/* Preview pane */}
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
              {selectedRestaurant ? selectedRestaurant.name : 'Restaurant'}
            </div>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {style} · {paper}
            </div>
            <div style={{
              borderTop: `1px solid ${preview.accent}55`,
              margin: '10px 0',
            }} />
            <div style={{ fontWeight: 700, color: preview.accent, fontSize: 13 }}>
              BREAKFAST MENU
            </div>
            <div style={{ marginTop: 6, color: '#111827', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>Classic Eggs Benedict</span>
                <span style={{ fontWeight: 700, color: preview.accent }}>$14.50</span>
              </div>
              <div style={{ color: '#6b7280', fontSize: 11, fontStyle: style === 'Classic' ? 'italic' : 'normal' }}>
                Two poached eggs on toasted English muffin, Canadian bacon, hollandaise.
              </div>
            </div>
            <div style={{ marginTop: 8, color: '#111827', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>Smoked Salmon Omelet</span>
                <span style={{ fontWeight: 700, color: preview.accent }}>$16.75</span>
              </div>
              <div style={{ color: '#6b7280', fontSize: 11, fontStyle: style === 'Classic' ? 'italic' : 'normal' }}>
                Three-egg omelet with cold-smoked salmon, dill cream cheese, chives.
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
              Live preview — full PDF includes all sections, categories, dishes.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
