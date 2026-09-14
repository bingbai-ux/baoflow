import * as React from 'react';

/** 管理画面の1行要約。3〜4項目まで。 */
export interface StatBandItem { value: React.ReactNode; label: React.ReactNode }
export interface StatBandProps {
  items: StatBandItem[];
  /** 右端の補足（自動アラートの条件など） */
  note?: React.ReactNode;
  style?: React.CSSProperties;
}
export function StatBand(props: StatBandProps): React.JSX.Element;
