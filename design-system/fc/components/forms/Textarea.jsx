import React from 'react';

/** 複数行入力。差し戻しコメントなど。 */
export function Textarea({ invalid, style, ...rest }) {
  return (
    <textarea
      style={{
        width: '100%', minHeight: 72, resize: 'vertical',
        fontFamily: 'var(--fc-font)', fontSize: 'var(--fc-fs-sm)', lineHeight: 1.7,
        padding: '10px 12px', borderRadius: 'var(--fc-r-input)',
        border: '1px solid ' + (invalid ? 'var(--fc-orange)' : 'var(--fc-line)'),
        background: 'var(--fc-card)', color: 'var(--fc-text-body)', ...style,
      }}
      {...rest}
    />
  );
}
