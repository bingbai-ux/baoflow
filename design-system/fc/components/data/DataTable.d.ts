import * as React from 'react';

export interface DataTableColumn {
  label: React.ReactNode;
  /** grid-template-columns の1トラック。省略で minmax(0,1fr) */
  width?: string;
  align?: 'left' | 'right';
  /** 数字列。tabular-nums が当たる */
  numeric?: boolean;
}
export interface DataTableRow {
  cells: React.ReactNode[];
  /** 行全体を Orange Tint 面にする（要対応） */
  alert?: boolean;
  selected?: boolean;
}
/**
 * 人事系の基本形。1行=1件の密な表。状態は Badge で列に固定する。
 * @startingPoint section="Data" subtitle="1行=1件の密な表" viewport="700x260"
 */
export interface DataTableProps {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  footer?: React.ReactNode;
  onRowClick?: (row: DataTableRow, index: number) => void;
  style?: React.CSSProperties;
}
export function DataTable(props: DataTableProps): React.JSX.Element;
