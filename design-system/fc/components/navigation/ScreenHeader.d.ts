import * as React from 'react';

/** 管理画面の見出し帯。meta には対象・件数・読み方の補足を書く。 */
export interface ScreenHeaderProps {
  title: React.ReactNode;
  /** 「渋谷店 · 未処理 4件 · 差し戻しにはコメントが必要です」のような一行 */
  meta?: React.ReactNode;
  /** FilterChip の並びなど */
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}
export function ScreenHeader(props: ScreenHeaderProps): React.JSX.Element;
