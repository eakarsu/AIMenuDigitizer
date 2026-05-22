import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LabelList,
} from 'recharts';

// DishPopularity — horizontal bar chart of top-N dishes by order count.

function CustomTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div style={{
      background: '#111827', color: '#fff', padding: '8px 10px',
      borderRadius: 6, fontSize: 12, lineHeight: 1.4,
    }}>
      <div style={{ fontWeight: 700 }}>{p.name}</div>
      <div>{p.section} · {p.category}</div>
      <div>Orders: <strong>{p.orderCount}</strong></div>
      <div>Price: <strong>${Number(p.price).toFixed(2)}</strong></div>
    </div>
  );
}

export default function DishPopularity({ data, loading, error }) {
  if (loading) {
    return <div style={{ padding: 16, color: '#6b7280' }}>Loading popularity chart…</div>;
  }
  if (error) {
    return <div style={{ padding: 16, color: '#b91c1c' }}>Error: {error}</div>;
  }
  const dishes = (data && data.dishes) || [];
  if (dishes.length === 0) {
    return <div style={{ padding: 16, color: '#6b7280' }}>No dish popularity data.</div>;
  }

  // Tallest bar on top: reverse so highest order count appears first visually.
  const chartData = [...dishes].reverse().map((d) => ({
    ...d,
    shortName: d.name.length > 28 ? d.name.slice(0, 26) + '…' : d.name,
  }));

  const height = Math.max(360, chartData.length * 28);

  return (
    <div data-testid="dish-popularity" style={{
      background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16,
    }}>
      <div style={{ marginBottom: 8, color: '#374151', fontSize: 13 }}>
        Top <strong>{dishes.length}</strong> dishes by simulated order count
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 32, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis
              type="category"
              dataKey="shortName"
              width={170}
              tick={{ fontSize: 11, fill: '#374151' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="orderCount" fill="#6366f1" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="orderCount" position="right" style={{ fontSize: 11, fill: '#374151' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
