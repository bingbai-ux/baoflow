import React from 'react';

/** 項目名と値の対。申請内容・台帳の基本情報など。 */
export function KVTable({ rows = [], labelWidth = '132px', style }) {
  return (
    <div style={{
      border: '1px solid var(--fc-line)', borderRadius: 'var(--fc-r-card)',
      overflow: 'hidden', minWidth: 0, ...style,
    }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: labelWidth + ' 1fr', gap: 'var(--fc-sp-2)',
          padding: '9px 14px', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--fc-line)',
          background: i % 2 ? 'var(--fc-card-soft)' : 'var(--fc-card)',
        }}>
          <span style={{ fontSize: 'var(--fc-fs-sm)', lineHeight: 1.5, color: 'var(--fc-text-muted)' }}>{r.k}</span>
          <span className="fc-num" style={{ fontSize: 'var(--fc-fs-sm)', lineHeight: 1.5, minWidth: 0 }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}
