import React from 'react';

/** 丸アイコンボタン。よく使う操作の近道。Wasabi=主要 / Cool Blue=補助。 */
export function IconButton({ tone = 'alt', label, children, style, ...rest }) {
  const bg = tone === 'main' ? 'var(--fc-wasabi)' : 'var(--fc-coolblue)';
  const ink = tone === 'main' ? 'var(--fc-wasabi-ink)' : 'var(--fc-blue-ink)';
  return (
    <button
      aria-label={label}
      title={label}
      style={{
        width: 40, height: 40, flex: 'none', borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: bg, color: ink, fontFamily: 'var(--fc-font)', fontSize: 15, fontWeight: 'var(--fc-fw-bold)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style,
      }}
      {...rest}
    >{children}</button>
  );
}
