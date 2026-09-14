import React from 'react';

/** 絞り込み用チップ（D80）。中身の切替には使わない（→ FileTabs）。 */
export function FilterChip({ active, children, style, ...rest }) {
  return (
    <button
      aria-pressed={!!active}
      style={{
        flex: 'none', whiteSpace: 'nowrap', cursor: 'pointer',
        fontFamily: 'var(--fc-font)', fontSize: 'var(--fc-fs-sm)', fontWeight: 'var(--fc-fw-bold)',
        lineHeight: 'var(--fc-lh-flat)', padding: '8px 14px', borderRadius: 'var(--fc-r-pill)',
        borderWidth: 1, borderStyle: 'solid',
        background: active ? 'var(--fc-cassis)' : 'var(--fc-card)',
        color: active ? 'var(--fc-cassis-tint)' : 'var(--fc-ink-soft)',
        borderColor: active ? 'var(--fc-cassis)' : 'var(--fc-line)',
        ...style,
      }}
      {...rest}
    >{children}</button>
  );
}
