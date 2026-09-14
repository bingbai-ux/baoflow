import React from 'react';

/** 白地の数値強調。インク直置きの代わりに必ず面を持たせる。 */
export function MetricPill({ tone = 'info', children, style, ...rest }) {
  const T = {
    info: { background: 'var(--fc-coolblue)', color: 'var(--fc-blue-ink)' },
    warn: { background: 'var(--fc-orange-tint)', color: 'var(--fc-orange-ink)' },
    note: { background: 'var(--fc-wasabi)', color: 'var(--fc-wasabi-ink)' },
    mute: { background: 'var(--fc-bg)', color: 'var(--fc-ink-soft)' },
  };
  return (
    <span className="fc-num" style={{
      display: 'inline-block', whiteSpace: 'nowrap', flex: 'none',
      fontSize: 'var(--fc-fs-xs)', fontWeight: 'var(--fc-fw-bold)', lineHeight: 'var(--fc-lh-flat)',
      padding: '5px 10px', borderRadius: 'var(--fc-r-pill)',
      ...T[tone], ...style,
    }} {...rest}>{children}</span>
  );
}
