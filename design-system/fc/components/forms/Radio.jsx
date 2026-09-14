import React from 'react';

/** ラジオ。2〜3択で、選ぶと何が起きるかが短く言えるときに使う。 */
export function Radio({ label, style, ...rest }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 'var(--fc-sp-2)',
      minHeight: 'var(--fc-tap-min)', cursor: 'pointer',
      fontSize: 'var(--fc-fs-sm)', color: 'var(--fc-text-body)', ...style,
    }}>
      <input type="radio" style={{ width: 16, height: 16, accentColor: 'var(--fc-accent-form)' }} {...rest} />
      {label}
    </label>
  );
}
