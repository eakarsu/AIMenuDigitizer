import React, { useEffect, useState } from 'react';
import MenuTree from '../components/MenuTree';
import DishPopularity from '../components/DishPopularity';
import MenuPDFExporter from '../components/MenuPDFExporter';
import MenuOCRUpload from '../components/MenuOCRUpload';

// CustomViewsPage — Menu Analytics dashboard combining the hierarchy tree
// and the dish popularity bar chart from /api/custom-views.

const API = ''; // same-origin via Vite proxy if configured; else relative

function authHeaders() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function getJSON(path) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json', ...authHeaders() } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function CustomViewsPage() {
  const [tree, setTree] = useState(null);
  const [pop, setPop] = useState(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [popLoading, setPopLoading] = useState(true);
  const [treeErr, setTreeErr] = useState(null);
  const [popErr, setPopErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getJSON(`${API}/api/custom-views/menu-tree`);
        if (!cancelled) setTree(data);
      } catch (e) {
        if (!cancelled) setTreeErr(e.message);
      } finally {
        if (!cancelled) setTreeLoading(false);
      }
    })();
    (async () => {
      try {
        const data = await getJSON(`${API}/api/custom-views/dish-popularity?limit=15`);
        if (!cancelled) setPop(data);
      } catch (e) {
        if (!cancelled) setPopErr(e.message);
      } finally {
        if (!cancelled) setPopLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div data-testid="custom-views-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>
          Menu Analytics
        </h1>
        <p style={{ color: '#6b7280', marginTop: 6, fontSize: 14 }}>
          Bespoke custom views: hierarchical menu structure and dish popularity insights.
        </p>
      </header>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
          Menu Hierarchy Tree
        </h2>
        <MenuTree data={tree} loading={treeLoading} error={treeErr} />
      </section>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
          Top 15 Dishes by Order Count
        </h2>
        <DishPopularity data={pop} loading={popLoading} error={popErr} />
      </section>

      <section data-testid="menu-pdf-exporter-section">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
          Menu PDF Export
        </h2>
        <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0, marginBottom: 10 }}>
          Pick a restaurant, choose a style and paper size, then download a print-ready menu PDF.
        </p>
        <MenuPDFExporter />
      </section>

      <section data-testid="menu-ocr-upload-section">
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
          OCR Menu Image Upload
        </h2>
        <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0, marginBottom: 10 }}>
          Drag-and-drop a photo of a menu to extract sections, dishes, and prices (mock OCR).
        </p>
        <MenuOCRUpload />
      </section>
    </div>
  );
}
