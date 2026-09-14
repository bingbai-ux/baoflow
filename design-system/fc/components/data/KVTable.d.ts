import * as React from 'react';

export interface KVRow { k: React.ReactNode; v: React.ReactNode }
/** 項目名=値の縦並び。奇数行は行背景でしま模様にする。 */
export interface KVTableProps {
  rows: KVRow[];
  labelWidth?: string;
  style?: React.CSSProperties;
}
export function KVTable(props: KVTableProps): React.JSX.Element;
