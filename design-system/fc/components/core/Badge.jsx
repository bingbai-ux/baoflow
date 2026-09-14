import React from 'react';

const TONES = {
  new:  { background: 'var(--fc-wasabi)', color: 'var(--fc-wasabi-ink)', border: '1px solid transparent' },
  info: { background: 'var(--fc-coolblue)', color: 'var(--fc-blue-ink)', border: '1px solid transparent' },
  soft: { background: 'var(--fc-sauge)', color: 'var(--fc-sauge-ink)', border: '1px solid transparent' },
  hot:  { background: 'var(--fc-orange-tint)', color: 'var(--fc-orange-ink)', border: '1px solid transparent' },
  mute: { background: 'var(--fc-bg)', color: 'var(--fc-ink-soft)', border: '1px solid var(--fc-line)' },
};

/** 状態バッジ。全機能でこの5種に統一する。必ず文字を入れる（色だけで意味を出さない）。 */
export function Badge({ tone = 'mute', children, style, ...rest }) {
  return (
    <span
      style={{
        display: 'inline-block', whiteSpace: 'nowrap', flex: 'none',
        fontSize: 'var(--fc-fs-xs)', fontWeight: 'var(--fc-fw-bold)', lineHeight: 'var(--fc-lh-flat)',
        padding: '5px 12px', borderRadius: 'var(--fc-r-pill)',
        fontVariantNumeric: 'tabular-nums',
        ...TONES[tone], ...style,
      }}
      {...rest}
    >{children}</span>
  );
}
