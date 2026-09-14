import React from 'react';

/** Cassis面のサイドバー。大カテゴリー→（必要なら）サブ→項目の3階層。選択中だけ Wasabi。 */
export function Sidebar({ brand = 'F&C Portal', hub, roleLabel, items = [], activeId, onSelect, footer, style }) {
  let catCount = 0;
  return (
    <nav style={{
      width: 'var(--fc-sidebar-w)', flex: 'none', background: 'var(--fc-surface-dark)',
      padding: '20px 12px 16px', display: 'flex', flexDirection: 'column', minHeight: 0, ...style,
    }}>
      <span style={{
        alignSelf: 'flex-start', flex: 'none', whiteSpace: 'nowrap',
        background: 'var(--fc-wasabi)', color: 'var(--fc-wasabi-ink)',
        fontSize: 12, fontWeight: 'var(--fc-fw-black)', letterSpacing: 'var(--fc-tracking-en)',
        lineHeight: 'var(--fc-lh-flat)', padding: '6px 14px', borderRadius: 'var(--fc-r-pill)',
      }}>{brand}</span>

      {(hub || roleLabel) && (
        <div style={{ marginTop: 'var(--fc-sp-3)', padding: '0 var(--fc-sp-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--fc-sp-2)' }}>
          <span style={{ fontSize: 13, fontWeight: 'var(--fc-fw-black)', color: 'var(--fc-text-on-dark)', lineHeight: 'var(--fc-lh-flat)' }}>{hub}</span>
          <span style={{ fontSize: 10.5, fontWeight: 'var(--fc-fw-bold)', color: 'var(--fc-text-on-dark-muted)', lineHeight: 'var(--fc-lh-flat)' }}>{roleLabel}</span>
        </div>
      )}

      <div style={{ marginTop: 'var(--fc-sp-2)', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto', minHeight: 0 }}>
        {items.map((it, i) => {
          if (it.kind === 'category') {
            catCount += 1;
            return (
              <span key={i} style={{
                marginTop: catCount === 1 ? 2 : 12, padding: '10px 10px 6px',
                borderTop: catCount === 1 ? 'none' : '1px solid var(--fc-cassis-soft)',
                fontSize: 11.5, fontWeight: 'var(--fc-fw-black)', letterSpacing: '.08em',
                color: 'var(--fc-text-on-dark)', lineHeight: 'var(--fc-lh-flat)',
              }}>{it.label}</span>
            );
          }
          if (it.kind === 'sub') {
            return (
              <span key={i} style={{
                padding: '8px 10px 4px', fontSize: 10.5, fontWeight: 'var(--fc-fw-bold)',
                letterSpacing: '.06em', color: 'var(--fc-text-on-dark)', opacity: .8, lineHeight: 'var(--fc-lh-flat)',
              }}>{it.label}</span>
            );
          }
          const on = it.id === activeId;
          return (
            <button key={i} onClick={() => onSelect && onSelect(it.id)} style={{
              textAlign: 'left', border: 'none', cursor: 'pointer',
              borderRadius: 'var(--fc-r-input)', padding: '9px 12px',
              background: on ? 'var(--fc-wasabi)' : 'transparent',
              display: 'flex', alignItems: 'center', gap: 'var(--fc-sp-2)',
              paddingLeft: it.indent ? 20 : 12,
            }}>
              <span style={{
                flex: 1, minWidth: 0, fontFamily: 'var(--fc-font)', fontSize: 12.5, lineHeight: 1.4,
                fontWeight: on ? 'var(--fc-fw-black)' : 'var(--fc-fw-medium)',
                color: on ? 'var(--fc-wasabi-ink)' : 'var(--fc-text-on-dark)',
              }}>{it.label}</span>
              {it.badge && (
                <span className="fc-num" style={{
                  flex: 'none', fontSize: 10, fontWeight: 'var(--fc-fw-black)', lineHeight: 1,
                  padding: '4px 8px', borderRadius: 'var(--fc-r-pill)',
                  background: on ? 'var(--fc-card)' : 'var(--fc-orange-tint)',
                  color: on ? 'var(--fc-wasabi-ink)' : 'var(--fc-orange-ink)',
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {footer && (
        <div style={{ marginTop: 'auto', paddingTop: 'var(--fc-sp-3)', borderTop: '1px solid var(--fc-cassis-soft)' }}>{footer}</div>
      )}
    </nav>
  );
}
