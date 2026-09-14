import React from 'react';

/** 横棒 + 基準線。予算・義務日数など「越えてはいけない/届かせたい線」を黒線で示す。 */
export function BaselineBar({ value = 0, baseline, tone = 'now', height = 14, style }) {
  const fill = tone === 'warn' ? 'var(--fc-bar-warn)' : tone === 'past' ? 'var(--fc-bar-past)' : 'var(--fc-bar-now)';
  return (
    <span style={{
      position: 'relative', display: 'block', flex: 1, minWidth: 0,
      height, background: 'var(--fc-bar-track)', borderRadius: 'var(--fc-r-pill)', ...style,
    }}>
      <span style={{ display: 'block', height, width: value + '%', background: fill, borderRadius: 'var(--fc-r-pill)' }} />
      {baseline != null && (
        <span aria-hidden style={{
          position: 'absolute', top: -4, bottom: -4, left: baseline === 100 ? undefined : baseline + '%',
          right: baseline === 100 ? 0 : undefined,
          width: 2, background: 'var(--fc-bar-baseline)',
        }} />
      )}
    </span>
  );
}
