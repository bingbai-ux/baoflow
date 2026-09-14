import * as React from 'react';

/** 一覧の絞り込みチップ。選択中は Cassis 面 + Cassis Tint 文字。 */
export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children?: React.ReactNode;
}
export function FilterChip(props: FilterChipProps): React.JSX.Element;
