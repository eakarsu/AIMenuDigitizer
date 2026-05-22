import React, { useState } from 'react';

// MenuTree — collapsible tree of sections -> categories -> dishes.
// Each leaf dish shows its price and a popularity badge.

const BADGE_STYLE = {
  hot:     { bg: '#fee2e2', fg: '#991b1b', label: 'Hot'     },
  popular: { bg: '#ffedd5', fg: '#9a3412', label: 'Popular' },
  steady:  { bg: '#dbeafe', fg: '#1e40af', label: 'Steady'  },
  slow:    { bg: '#f3f4f6', fg: '#374151', label: 'Slow'    },
};

function Caret({ open }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 14, height: 14, marginRight: 6,
      textAlign: 'center', fontSize: 11, color: '#6b7280',
      transform: open ? 'rotate(90deg)' : 'rotate(0)',
      transition: 'transform 120ms ease',
    }}>▶</span>
  );
}

function Badge({ kind }) {
  const s = BADGE_STYLE[kind] || BADGE_STYLE.steady;
  return (
    <span style={{
      background: s.bg, color: s.fg,
      fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 999, marginLeft: 8,
    }}>{s.label}</span>
  );
}

function DishLeaf({ dish }) {
  return (
    <li style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 10px', marginLeft: 32,
      borderLeft: '2px solid #e5e7eb',
    }}>
      <span style={{ color: '#111827', fontSize: 14 }}>
        {dish.name}
        <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 8 }}>
          ({dish.orderCount} orders)
        </span>
      </span>
      <span>
        <span style={{ fontWeight: 600, color: '#065f46' }}>
          ${Number(dish.price).toFixed(2)}
        </span>
        <Badge kind={dish.badge} />
      </span>
    </li>
  );
}

function CategoryNode({ category }) {
  const [open, setOpen] = useState(true);
  return (
    <li style={{ listStyle: 'none', marginLeft: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '6px 0', display: 'flex', alignItems: 'center',
          fontSize: 14, fontWeight: 600, color: '#374151',
        }}
      >
        <Caret open={open} />
        {category.name}
        <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
          ({category.dishes.length} dishes)
        </span>
      </button>
      {open && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 8px 0' }}>
          {category.dishes.map((d) => <DishLeaf key={d.id} dish={d} />)}
        </ul>
      )}
    </li>
  );
}

function SectionNode({ section }) {
  const [open, setOpen] = useState(true);
  const dishCount = section.categories.reduce((n, c) => n + c.dishes.length, 0);
  return (
    <li style={{ listStyle: 'none', marginBottom: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '8px 12px', cursor: 'pointer', width: '100%',
          display: 'flex', alignItems: 'center',
          fontSize: 15, fontWeight: 700, color: '#111827',
        }}
      >
        <Caret open={open} />
        {section.name}
        <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
          {section.categories.length} categories · {dishCount} dishes
        </span>
      </button>
      {open && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0 0' }}>
          {section.categories.map((c) => <CategoryNode key={c.id} category={c} />)}
        </ul>
      )}
    </li>
  );
}

export default function MenuTree({ data, loading, error }) {
  if (loading) {
    return <div style={{ padding: 16, color: '#6b7280' }}>Loading menu hierarchy…</div>;
  }
  if (error) {
    return <div style={{ padding: 16, color: '#b91c1c' }}>Error: {error}</div>;
  }
  if (!data || !data.sections || data.sections.length === 0) {
    return <div style={{ padding: 16, color: '#6b7280' }}>No menu data available.</div>;
  }
  return (
    <div data-testid="menu-tree" style={{
      background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16,
    }}>
      <div style={{ marginBottom: 12, color: '#374151', fontSize: 13 }}>
        <strong>{data.totalSections}</strong> sections ·{' '}
        <strong>{data.totalDishes}</strong> total dishes
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {data.sections.map((s) => <SectionNode key={s.id} section={s} />)}
      </ul>
    </div>
  );
}
