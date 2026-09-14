import React from 'react';

/** お知らせ1行。未読は行背景＋バッジ、既読は文字を細く薄く。 */
export function NoticeRow({ badge, title, date, unread, last, onClick, style }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 'var(--fc-sp-2)',
      padding: '11px 14px', minHeight: 'var(--fc-tap-min)',
      borderBottom: last ? 'none' : '1px solid var(--fc-line)',
      background: unread ? 'var(--fc-card)' : 'var(--fc-card-soft)',
      cursor: onClick ? 'pointer' : 'default', minWidth: 0, ...style,
    }}>
      {badge && (
        <span style={{
          flex: 'none', background: 'var(--fc-orange-tint)', color: 'var(--fc-orange-ink)',
          fontSize: 10.5, fontWeight: 'var(--fc-fw-bold)', lineHeight: 1,
          padding: '4px 9px', borderRadius: 'var(--fc-r-pill)',
        }}>{badge}</span>
      )}
      <span style={{
        flex: 1, minWidth: 0, fontSize: 'var(--fc-fs-sm)', lineHeight: 1.4,
        fontWeight: unread ? 'var(--fc-fw-bold)' : 'var(--fc-fw-normal)',
        color: unread ? 'var(--fc-text-body)' : 'var(--fc-text-muted)',
      }}>{title}</span>
      {date && <span className="fc-num" style={{ flex: 'none', fontSize: 'var(--fc-fs-xs)', color: 'var(--fc-text-muted)' }}>{date}</span>}
    </div>
  );
}
