import React from 'react';

/** 空状態。「無い」ではなく「次に何をするか」を書く。 */
export function EmptyState({ title, children, action, style }) {
  return (
    <div style={{
      border: '1px dashed var(--fc-line)', borderRadius: 'var(--fc-r-card)',
      background: 'var(--fc-card-soft)', padding: 'var(--fc-sp-4)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--fc-sp-2)',
      textAlign: 'center', minWidth: 0, ...style,
    }}>
      <span style={{ fontSize: 'var(--fc-fs-lg)', fontWeight: 'var(--fc-fw-black)', lineHeight: 1.4 }}>{title}</span>
      {children && <span style={{ fontSize: 'var(--fc-fs-sm)', lineHeight: 1.7, color: 'var(--fc-text-muted)', maxWidth: 360 }}>{children}</span>}
      {action}
    </div>
  );
}
