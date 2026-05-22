import React, { useRef, useState } from 'react';

// MenuOCRUpload — drag-drop a menu image; backend returns a mock parsed menu structure.

function authHeaders() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';

export default function MenuOCRUpload() {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null); // { url, name, size }
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  function setFile(file) {
    if (!file) return;
    setError(null);
    setResult(null);
    if (preview && preview.url) URL.revokeObjectURL(preview.url);
    const url = URL.createObjectURL(file);
    setPreview({ url, name: file.name, size: file.size, file });
  }

  function onSelect(e) {
    const f = e.target.files && e.target.files[0];
    if (f) setFile(f);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function handleParse() {
    if (!preview || !preview.file) return;
    setError(null);
    setResult(null);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('image', preview.file);
      const res = await fetch('/api/custom-views/menu-ocr', {
        method: 'POST',
        headers: { ...authHeaders() },
        body: fd,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  }

  function reset() {
    if (preview && preview.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  return (
    <div data-testid="menu-ocr-upload" style={{
      background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* LEFT: drop zone + preview */}
        <div>
          {!preview ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current && inputRef.current.click()}
              data-testid="ocr-dropzone"
              style={{
                border: `2px dashed ${dragging ? '#6366f1' : '#cbd5e1'}`,
                background: dragging ? '#eef2ff' : '#f9fafb',
                borderRadius: 10,
                padding: 28,
                textAlign: 'center',
                cursor: 'pointer',
                color: '#475569',
                transition: 'all 120ms ease',
                minHeight: 220,
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 42, marginBottom: 8 }}>↑</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>
                Drop a menu image here
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                or click to choose (PNG, JPG, WebP — max 15MB)
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                onChange={onSelect}
                data-testid="ocr-file-input"
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div>
              <div style={{
                border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
                background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 180, maxHeight: 320,
              }}>
                <img
                  src={preview.url}
                  alt={preview.name}
                  data-testid="ocr-preview-img"
                  style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain' }}
                />
              </div>
              <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>
                <strong>{preview.name}</strong>{' '}
                <span style={{ color: '#6b7280' }}>({Math.round(preview.size / 1024)} KB)</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={handleParse}
                  disabled={parsing}
                  data-testid="ocr-parse-btn"
                  style={{
                    padding: '8px 14px', borderRadius: 6, border: 'none',
                    background: parsing ? '#9ca3af' : '#10b981', color: '#fff',
                    fontWeight: 700, cursor: parsing ? 'wait' : 'pointer', fontSize: 13,
                  }}
                >
                  {parsing ? 'Parsing image…' : 'Parse Menu'}
                </button>
                <button
                  onClick={reset}
                  style={{
                    padding: '8px 14px', borderRadius: 6, border: '1px solid #d1d5db',
                    background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 13,
                  }}
                >Remove</button>
              </div>
              {error && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 8 }}>Error: {error}</div>}
            </div>
          )}
        </div>

        {/* RIGHT: parsed result */}
        <div style={{
          background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12,
          minHeight: 220,
        }}>
          {!result ? (
            <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 60 }}>
              Parsed menu structure will appear here.
            </div>
          ) : (
            <div data-testid="ocr-result">
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 8,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                  Parsed Menu
                </div>
                <div style={{
                  background: result.confidence >= 0.85 ? '#dcfce7' : '#fef3c7',
                  color: result.confidence >= 0.85 ? '#166534' : '#92400e',
                  borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700,
                }}>
                  {(result.confidence * 100).toFixed(1)}% confidence
                </div>
              </div>

              {result.parsed_sections.map((sec, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: '#4338ca',
                    borderBottom: '1px solid #e5e7eb', paddingBottom: 4, marginBottom: 6,
                  }}>
                    {sec.name}
                  </div>
                  {sec.dishes.map((d, j) => (
                    <div key={j} style={{ marginBottom: 6 }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 12, color: '#111827',
                      }}>
                        <span style={{ fontWeight: 600 }}>{d.name}</span>
                        <span style={{ fontWeight: 700, color: '#065f46' }}>
                          ${Number(d.price).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{d.description}</div>
                    </div>
                  ))}
                </div>
              ))}

              <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right' }}>
                {result.note}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
