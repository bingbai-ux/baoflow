import React from 'react';

/** 緊急・期限の告知帯。Orange Tint面 + Orange Ink（D78: Orange原色の大面積塗りはしない）。 */
export function AlertBanner({ title, children, action, style }) {
  return (
    <div style={{
      background: 'var(--fc-surface-alert)', color: 'var(--fc-text-on-alert)',
      borderRadius: 'var(--fc-r-card)', padding: '14px var(--fc-sp-3)',
      display: 'flex', alignItems: 'center', gap: 'var(--fc-sp-2)', minWidth: 0, ...style,
    }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 'var(--fc-fw-black)', lineHeight: 1.4 }}>{title}</span>
        {children && <span style={{ fontSize: 'var(--fc-fs-xs)', fontWeight: 'var(--fc-fw-medium)', lineHeight: 1.5 }}>{children}</span>}
      </div>
      {action}
    </div>
  );
}
