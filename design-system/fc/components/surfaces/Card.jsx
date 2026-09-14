import React from 'react';

/** 白いカード。影は使わず線で区切る。見出しは title、右端に action。 */
export function Card({ title, action, padded = true, children, style }) {
  return (
    <section style={{
      background: 'var(--fc-surface-card)', border: '1px solid var(--fc-line)',
      borderRadius: 'var(--fc-r-card)', overflow: 'hidden', minWidth: 0, ...style,
    }}>
      {(title || action) && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--fc-sp-2)',
          padding: '11px var(--fc-sp-3)', borderBottom: '1px solid var(--fc-line)',
        }}>
          <h3 style={{ margin: 0, fontSize: 'var(--fc-fs-lg)', fontWeight: 'var(--fc-fw-black)', lineHeight: 'var(--fc-lh-flat)' }}>{title}</h3>
          {action}
        </header>
      )}
      <div style={{ padding: padded ? 'var(--fc-sp-3)' : 0, minWidth: 0 }}>{children}</div>
    </section>
  );
}
