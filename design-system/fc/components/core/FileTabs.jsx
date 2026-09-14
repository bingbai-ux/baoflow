import React from 'react';

/** ファイルタブ（D80）。選択中のタブと下のパネルが1枚の紙のようにつながる。 */
export function FileTabs({ tabs = [], value, onChange, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, ...style }}>
      <div style={{ display: 'flex', gap: 'var(--fc-sp-1)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const on = t === value;
          return (
            <button
              key={t}
              onClick={() => onChange && onChange(t)}
              style={{
                flex: 'none', whiteSpace: 'nowrap', cursor: 'pointer',
                fontFamily: 'var(--fc-font)', fontSize: 12, fontWeight: 'var(--fc-fw-bold)',
                lineHeight: 'var(--fc-lh-flat)',
                padding: on ? '8px 18px' : '8px 18px 7px',
                border: '1px solid var(--fc-line)', borderBottom: 'none',
                borderRadius: 'var(--fc-r-tab)',
                background: on ? 'var(--fc-card)' : 'var(--fc-card-soft)',
                color: on ? 'var(--fc-text-body)' : 'var(--fc-ink-soft)',
                position: 'relative', zIndex: on ? 2 : 1,
                marginBottom: on ? -1 : 0,
              }}
            >{t}</button>
          );
        })}
      </div>
      <div style={{
        border: '1px solid var(--fc-line)', borderRadius: 'var(--fc-r-tab-panel)',
        background: 'var(--fc-card)', padding: 'var(--fc-sp-3)', position: 'relative', zIndex: 1, minWidth: 0,
      }}>{children}</div>
    </div>
  );
}
