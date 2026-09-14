import React from 'react';

/** ひとこと・説明・AIのきづき用のカード（D79）。面=Wasabi、文字=Wasabi Ink。 */
export function NoteCard({ title, children, style }) {
  return (
    <section style={{
      background: 'var(--fc-surface-note)', color: 'var(--fc-text-on-note)',
      borderRadius: 'var(--fc-r-card)', padding: 'var(--fc-sp-3)', minWidth: 0, ...style,
    }}>
      {title && <div style={{ fontSize: 12, fontWeight: 'var(--fc-fw-black)', lineHeight: 'var(--fc-lh-flat)' }}>{title}</div>}
      <div style={{ marginTop: title ? 'var(--fc-sp-1)' : 0, fontSize: 'var(--fc-fs-sm)', lineHeight: 1.8 }}>{children}</div>
    </section>
  );
}
