import * as React from 'react';

export interface BottomNavItem { id: string; label: React.ReactNode; badge?: React.ReactNode }
/**
 * スマホ下部の5タブ。店舗スタッフの主動線。各タブは44px以上。
 * @startingPoint section="Navigation" subtitle="スマホのボトムナビ5タブ" viewport="390x90"
 */
export interface BottomNavProps {
  /** 5件まで。ホーム / シフト / 打刻 / 申請 / メニュー */
  items: BottomNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  style?: React.CSSProperties;
}
export function BottomNav(props: BottomNavProps): React.JSX.Element;
