import React from 'react';

/** 数値・データを載せるカード（D79）。面=Cool Blue、文字=Blue Ink。 */
export function DataCard({ title, meta, children, style }) {
  return (
    <section style={{
      background: 'var(--fc-surface-data)', color: 'var(--fc-text-on-data)',
      borderRadius: 'var(--fc-r-card)', padding: 'var(--fc-sp-3)', minWidth: 0, ...style,
    }}>
      {(title || meta) && (
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--fc-sp-2)' }}>
          {title && <span style={{ fontSize: 'var(--fc-fs-sm)', fontWeight: 'var(--fc-fw-bold)', lineHeight: 'var(--fc-lh-flat)' }}>{title}</span>}
          {meta && <span style={{ fontSize: 'var(--fc-fs-xs)', fontWeight: 'var(--fc-fw-medium)', lineHeight: 'var(--fc-lh-flat)' }}>{meta}</span>}
        </header>
      )}
      <div style={{ marginTop: title || meta ? 'var(--fc-sp-2)' : 0, minWidth: 0 }}>{children}</div>
    </section>
  );
}
