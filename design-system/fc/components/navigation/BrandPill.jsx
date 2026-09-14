import React from 'react';

/** ロゴの代わりの文字ピル。ロゴ画像は支給されていないため、常にこの表記を使う。 */
export function BrandPill({ children = 'F&C Portal', style, ...rest }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', flex: 'none', whiteSpace: 'nowrap',
      background: 'var(--fc-wasabi)', color: 'var(--fc-wasabi-ink)',
      fontFamily: 'var(--fc-font)', fontSize: 12, fontWeight: 'var(--fc-fw-black)',
      letterSpacing: 'var(--fc-tracking-en)', lineHeight: 'var(--fc-lh-flat)',
      padding: '6px 14px', borderRadius: 'var(--fc-r-pill)', ...style,
    }} {...rest}>{children}</span>
  );
}
