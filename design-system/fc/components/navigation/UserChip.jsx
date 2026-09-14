import React from 'react';

/** サイドバー最下部の本人表示。Cassis面の上で使う。 */
export function UserChip({ face, name, role, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, ...style }}>
      <span style={{
        width: 32, height: 32, flex: 'none', borderRadius: '50%',
        background: 'var(--fc-avatar-bg)', color: 'var(--fc-avatar-ink)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 'var(--fc-fw-black)', lineHeight: 1,
      }}>{face}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 'var(--fc-fw-bold)', lineHeight: 1.2, color: 'var(--fc-text-on-dark)' }}>{name}</span>
        <span style={{ fontSize: 11, fontWeight: 'var(--fc-fw-medium)', lineHeight: 1.2, color: 'var(--fc-text-on-dark-muted)' }}>{role}</span>
      </span>
    </div>
  );
}
