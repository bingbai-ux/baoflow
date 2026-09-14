import React from 'react';

/** 管理画面の見出し。左に画面名と対象、右に絞り込みチップ。 */
export function ScreenHeader({ title, meta, actions, style }) {
  return (
    <header style={{
      padding: '22px 26px 14px', borderBottom: '1px solid var(--fc-line)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--fc-sp-3)',
      flexWrap: 'wrap', minWidth: 0, ...style,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fc-fs-xl)', fontWeight: 'var(--fc-fw-black)', lineHeight: 1.2 }}>{title}</h1>
        {meta && <span style={{ fontSize: 'var(--fc-fs-sm)', lineHeight: 1.5, color: 'var(--fc-text-muted)' }}>{meta}</span>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 'var(--fc-sp-1)', flexWrap: 'wrap' }}>{actions}</div>}
    </header>
  );
}
