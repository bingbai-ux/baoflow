import React from 'react';

const TONES = {
  main:   { background: 'var(--fc-wasabi)', color: 'var(--fc-wasabi-ink)', borderColor: 'transparent' },
  dark:   { background: 'var(--fc-cassis)', color: 'var(--fc-cassis-tint)', borderColor: 'transparent' },
  ghost:  { background: 'var(--fc-card)', color: 'var(--fc-text-body)', borderColor: 'var(--fc-line)' },
  danger: { background: 'var(--fc-card)', color: 'var(--fc-orange-ink)', borderColor: 'var(--fc-orange)' },
};

const SIZES = {
  md: { fontSize: 'var(--fc-fs-sm)', padding: '10px 20px' },
  lg: { fontSize: '13.5px', padding: '13px 26px' },
  sm: { fontSize: 'var(--fc-fs-xs)', padding: '6px 16px' },
};

/** 主要ボタン。Wasabi(main)は1画面に原則1つだけ。 */
export function Button({ tone = 'ghost', size = 'md', disabled, fullWidth, children, style, ...rest }) {
  const t = disabled
    ? { background: 'var(--fc-disabled-bg)', color: 'var(--fc-disabled-ink)', borderColor: 'var(--fc-line)' }
    : TONES[tone] || TONES.ghost;
  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--fc-sp-1)',
        fontFamily: 'var(--fc-font)', fontWeight: tone === 'main' ? 'var(--fc-fw-black)' : 'var(--fc-fw-bold)',
        lineHeight: 'var(--fc-lh-flat)', whiteSpace: 'nowrap', flex: 'none',
        borderRadius: 'var(--fc-r-pill)', borderWidth: 1, borderStyle: 'solid',
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : undefined,
        transition: 'filter var(--fc-dur-fast) var(--fc-ease)',
        ...SIZES[size], ...t, ...style,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = 'brightness(var(--fc-hover-dim))'; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
      {...rest}
    >{children}</button>
  );
}
