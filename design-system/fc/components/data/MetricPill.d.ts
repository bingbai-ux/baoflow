import * as React from 'react';

/** 表・カード内の数値を面に載せるピル。白地への Blue/Orange Ink 直置きを避けるための部品。 */
export interface MetricPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'info' | 'warn' | 'note' | 'mute';
  children?: React.ReactNode;
}
export function MetricPill(props: MetricPillProps): React.JSX.Element;
