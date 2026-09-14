import React from 'react';

/** スマホのボトムナビ。Cassis面。現在地は Cassis Tint のバーと文字で示す（塗らない）。 */
export function BottomNav({ items = [], activeId, onSelect, style }) {
  return (
    <nav style={{
      background: 'var(--fc-surface-dark)', padding: '8px 6px 12px',
      display: 'grid', gridTemplateColumns: 'repeat(' + items.length + ', minmax(0,1fr))', gap: 2, ...style,
    }}>
      {items.map((it) => {
        const on = it.id === activeId;
        return (
          <button key={it.id} onClick={() => onSelect && onSelect(it.id)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '7px 2px', minHeight: 'var(--fc-tap-min)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative',
          }}>
            <span style={{ width: 18, height: 3, borderRadius: 'var(--fc-r-pill)', background: on ? 'var(--fc-cassis-tint)' : 'transparent' }} />
            <span style={{
              fontFamily: 'var(--fc-font)', fontSize: 10.5, fontWeight: 'var(--fc-fw-bold)', lineHeight: 1,
              color: on ? 'var(--fc-text-on-dark)' : 'var(--fc-text-on-dark-muted)',
            }}>{it.label}</span>
            {it.badge && (
              <span style={{
                position: 'absolute', top: 0, right: 6,
                background: 'var(--fc-orange-tint)', color: 'var(--fc-orange-ink)',
                fontSize: 9, fontWeight: 'var(--fc-fw-black)', lineHeight: 1,
                padding: '3px 6px', borderRadius: 'var(--fc-r-pill)',
              }}>{it.badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
