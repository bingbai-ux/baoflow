import React from 'react';

/** 画面上部の要約帯。数値と語を並べる（Cool Blue面）。 */
export function StatBand({ items = [], note, style }) {
  return (
    <div style={{
      background: 'var(--fc-surface-data)', color: 'var(--fc-text-on-data)',
      borderRadius: 'var(--fc-r-card)', padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 'var(--fc-sp-4)', flexWrap: 'wrap', minWidth: 0, ...style,
    }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span className="fc-num" style={{ fontSize: 21, fontWeight: 'var(--fc-fw-black)', lineHeight: 'var(--fc-lh-flat)' }}>{it.value}</span>
          <span style={{ fontSize: 'var(--fc-fs-sm)', fontWeight: 'var(--fc-fw-bold)', lineHeight: 'var(--fc-lh-flat)' }}>{it.label}</span>
        </span>
      ))}
      {note && <span style={{ marginLeft: 'auto', fontSize: 'var(--fc-fs-xs)', fontWeight: 'var(--fc-fw-medium)' }}>{note}</span>}
    </div>
  );
}
