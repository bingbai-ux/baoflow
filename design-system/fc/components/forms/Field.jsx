import React from 'react';

/** ラベル＋必須ピル＋入力欄＋ヘルプの1組。エラー時はヘルプが Orange Ink になる。 */
export function Field({ label, required, help, error, htmlFor, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, maxWidth: 420, ...style }}>
      <label htmlFor={htmlFor} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 'var(--fc-fs-sm)', fontWeight: 'var(--fc-fw-bold)', lineHeight: 'var(--fc-lh-flat)',
      }}>
        {label}
        {required && (
          <span style={{
            background: 'var(--fc-orange-tint)', color: 'var(--fc-orange-ink)',
            fontSize: 10, fontWeight: 'var(--fc-fw-bold)', padding: '3px 10px', borderRadius: 'var(--fc-r-pill)',
          }}>必須</span>
        )}
      </label>
      {children}
      {help && (
        <span style={{
          fontSize: 'var(--fc-fs-xs)', lineHeight: 1.6,
          color: error ? 'var(--fc-orange-ink)' : 'var(--fc-text-muted)',
        }}>{help}</span>
      )}
    </div>
  );
}
