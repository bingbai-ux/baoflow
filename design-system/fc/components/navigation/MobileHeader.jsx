import React from 'react';

/** スマホのヘッダー。Cassis面。戻る（枠線のみ）＋画面名＋本人。 */
export function MobileHeader({ title, sub, onBack, right, style }) {
  return (
    <header style={{
      background: 'var(--fc-surface-dark)', padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 'var(--fc-sp-2)', minWidth: 0, ...style,
    }}>
      {onBack && (
        <button onClick={onBack} aria-label="戻る" style={{
          flex: 'none', width: 30, height: 30, borderRadius: '50%',
          background: 'transparent', color: 'var(--fc-text-on-dark)',
          border: '1px solid var(--fc-cassis-soft)', cursor: 'pointer',
          fontFamily: 'var(--fc-font)', fontSize: 13, fontWeight: 'var(--fc-fw-black)', lineHeight: 1,
        }}>←</button>
      )}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 'var(--fc-fw-black)', lineHeight: 1.3, color: 'var(--fc-text-on-dark)' }}>{title}</span>
        {sub && <span style={{ fontSize: 11, fontWeight: 'var(--fc-fw-medium)', lineHeight: 1.3, color: 'var(--fc-text-on-dark-muted)' }}>{sub}</span>}
      </span>
      {right}
    </header>
  );
}
