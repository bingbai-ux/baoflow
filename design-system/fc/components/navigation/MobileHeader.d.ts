import * as React from 'react';

/** スマホ画面の上部帯。Cassis面の上では文字は Cassis Tint / Soft。 */
export interface MobileHeaderProps {
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** 戻る矢印を出す */
  onBack?: () => void;
  /** 右端（顔アイコン・バッジ） */
  right?: React.ReactNode;
  style?: React.CSSProperties;
}
export function MobileHeader(props: MobileHeaderProps): React.JSX.Element;
