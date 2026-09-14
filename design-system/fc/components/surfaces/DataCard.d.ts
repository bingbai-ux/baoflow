import * as React from 'react';

/**
 * 数値・データ用の Cool Blue カード（D79）。読む前に「データ」と分かるための面。
 * @startingPoint section="Surfaces" subtitle="Cool Blue=データ / Wasabi=ひとこと" viewport="700x200"
 */
export interface DataCardProps {
  title?: React.ReactNode;
  /** 右肩の日付や対象期間 */
  meta?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function DataCard(props: DataCardProps): React.JSX.Element;
