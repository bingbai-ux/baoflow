import React from 'react';

/** 顔アイコン。面は Cool Blue 固定（D78）。姓の1文字を入れる。 */
export function FaceAvatar({ children, size = 32, selected, highlight, style, ...rest }) {
  return (
    <span
      style={{
        width: size, height: size, flex: 'none', borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: highlight ? 'var(--fc-wasabi)' : 'var(--fc-avatar-bg)',
        color: highlight ? 'var(--fc-wasabi-ink)' : 'var(--fc-avatar-ink)',
        fontSize: Math.round(size * 0.34), fontWeight: 'var(--fc-fw-black)', lineHeight: 1,
        outline: selected ? '2.5px solid var(--fc-orange)' : 'none', outlineOffset: 1,
        ...style,
      }}
      {...rest}
    >{children}</span>
  );
}
