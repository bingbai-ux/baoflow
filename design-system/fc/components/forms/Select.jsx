import React from 'react';

/** ドロップダウン。6件以上の選択肢はチップではなくこれを使う。 */
export function Select({ options = [], invalid, style, ...rest }) {
  return (
    <select
      style={{
        width: '100%', fontFamily: 'var(--fc-font)', fontSize: 'var(--fc-fs-md)',
        padding: '10px 14px', borderRadius: 'var(--fc-r-input)',
        border: '1px solid ' + (invalid ? 'var(--fc-orange)' : 'var(--fc-line)'),
        background: 'var(--fc-card)', color: 'var(--fc-text-body)', ...style,
      }}
      {...rest}
    >
      {options.map((o) => {
        const value = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return <option key={value} value={value}>{label}</option>;
      })}
    </select>
  );
}
