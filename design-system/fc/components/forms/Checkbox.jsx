import React from 'react';

/** チェックボックス。accent-color で Cassis に染める（ブラウザ標準の青を混ぜない）。 */
export function Checkbox({ label, style, ...rest }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 'var(--fc-sp-2)',
      minHeight: 'var(--fc-tap-min)', cursor: 'pointer',
      fontSize: 'var(--fc-fs-sm)', color: 'var(--fc-text-body)', ...style,
    }}>
      <input type="checkbox" style={{ width: 16, height: 16, accentColor: 'var(--fc-accent-form)' }} {...rest} />
      {label}
    </label>
  );
}
