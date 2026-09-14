import React from 'react';

/** 権限で見せない項目の説明。錠アイコンは 🔒（絵文字）で統一。 */
export function LockNotice({ children, style }) {
  return (
    <div style={{
      display: 'flex', gap: 'var(--fc-sp-2)', alignItems: 'flex-start',
      background: 'var(--fc-card-soft)', border: '1px solid var(--fc-line)',
      borderRadius: 'var(--fc-r-card)', padding: '12px 14px', minWidth: 0, ...style,
    }}>
      <span aria-hidden style={{ flex: 'none', fontSize: 13, lineHeight: 1.5 }}>🔒</span>
      <span style={{ fontSize: 'var(--fc-fs-xs)', lineHeight: 1.7, color: 'var(--fc-text-muted)' }}>{children}</span>
    </div>
  );
}
