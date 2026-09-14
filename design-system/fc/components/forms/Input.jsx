import React from 'react';

/** 1行入力。focus は Cassis枠 + Wasabiの薄いリング。 */
export function Input({ invalid, style, ...rest }) {
  return (
    <input
      style={{
        width: '100%', fontFamily: 'var(--fc-font)', fontSize: 'var(--fc-fs-md)',
        padding: '10px 14px', borderRadius: 'var(--fc-r-input)',
        border: '1px solid ' + (invalid ? 'var(--fc-orange)' : 'var(--fc-line)'),
        background: 'var(--fc-card)', color: 'var(--fc-text-body)', ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.outline = 'none'; e.currentTarget.style.borderColor = 'var(--fc-cassis)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(233,240,86,.5)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = invalid ? 'var(--fc-orange)' : 'var(--fc-line)'; e.currentTarget.style.boxShadow = 'none'; }}
      {...rest}
    />
  );
}
