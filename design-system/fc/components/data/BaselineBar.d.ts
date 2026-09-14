import * as React from 'react';

/**
 * 横棒グラフ1本 + 基準線。基準線の意味は必ず近くに文章で書く（「黒線＝予算」）。
 * @startingPoint section="Data" subtitle="横棒 + 基準線（予算・義務5日）" viewport="700x150"
 */
export interface BaselineBarProps {
  /** 0-100 の塗り幅 */
  value: number;
  /** 0-100 の基準線位置。省略で線なし */
  baseline?: number;
  /** now=Wasabi(現在値) / past=Cool Blue(過去) / warn=Orange(未達・超過) */
  tone?: 'now' | 'past' | 'warn';
  height?: number;
  style?: React.CSSProperties;
}
export function BaselineBar(props: BaselineBarProps): React.JSX.Element;
