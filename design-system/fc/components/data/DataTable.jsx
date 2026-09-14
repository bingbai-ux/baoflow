import React from 'react';

/** 「1行=1人（1件）」の密な表（D80）。状態は列に固定する。 */
export function DataTable({ columns = [], rows = [], footer, onRowClick, style }) {
  const template = columns.map((c) => c.width || 'minmax(0,1fr)').join(' ');
  return (
    <div style={{
      border: '1px solid var(--fc-line)', borderRadius: 'var(--fc-r-card)',
      overflow: 'hidden', minWidth: 0, ...style,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: template, background: 'var(--fc-card-soft)', borderBottom: '1px solid var(--fc-line)' }}>
        {columns.map((c, i) => (
          <span key={i} style={{
            padding: '9px 12px', fontSize: 'var(--fc-fs-xs)', fontWeight: 'var(--fc-fw-bold)',
            lineHeight: 'var(--fc-lh-flat)', color: 'var(--fc-text-muted)',
            textAlign: c.align || 'left',
          }}>{c.label}</span>
        ))}
      </div>
      {rows.map((r, ri) => (
        <div
          key={ri}
          onClick={onRowClick ? () => onRowClick(r, ri) : undefined}
          style={{
            display: 'grid', gridTemplateColumns: template, alignItems: 'center',
            borderBottom: '1px solid var(--fc-line)',
            borderLeft: r.selected ? '3px solid var(--fc-cassis)' : '3px solid transparent',
            background: r.alert ? 'var(--fc-surface-alert)' : (r.selected || ri % 2 ? 'var(--fc-card-soft)' : 'var(--fc-card)'),
            cursor: onRowClick ? 'pointer' : 'default',
          }}
        >
          {columns.map((c, ci) => (
            <span key={ci} className={c.numeric ? 'fc-num' : undefined} style={{
              padding: '10px 12px', minWidth: 0,
              fontSize: 'var(--fc-fs-sm)', lineHeight: 1.4,
              fontWeight: ci === 0 ? 'var(--fc-fw-bold)' : 'var(--fc-fw-normal)',
              color: ci === 0 ? 'var(--fc-text-body)' : 'var(--fc-text-muted)',
              textAlign: c.align || 'left',
              display: 'flex', justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start', alignItems: 'center', gap: 6,
            }}>{r.cells[ci]}</span>
          ))}
        </div>
      ))}
      {footer && (
        <div style={{ padding: '11px 12px', fontSize: 'var(--fc-fs-xs)', color: 'var(--fc-text-muted)' }}>{footer}</div>
      )}
    </div>
  );
}
