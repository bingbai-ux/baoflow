import * as React from 'react';

/**
 * 状態バッジ（5種固定）。白地の強調はこのピルで行う（インク直置きは禁止）。
 * @startingPoint section="Core" subtitle="状態バッジ5種" viewport="700x120"
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** new=新着 / info=確認中 / soft=承認待ち / hot=期限間近 / mute=下書き */
  tone?: 'new' | 'info' | 'soft' | 'hot' | 'mute';
  children?: React.ReactNode;
}
export function Badge(props: BadgeProps): React.JSX.Element;
