import * as React from 'react';

export interface SidebarItem {
  /** category=大カテゴリー見出し / sub=サブ見出し / item=遷移先 */
  kind: 'category' | 'sub' | 'item';
  label: React.ReactNode;
  /** kind="item" のときの識別子 */
  id?: string;
  /** 未処理件数など。文字を併記する */
  badge?: React.ReactNode;
  /** sub の下の項目をインデントする */
  indent?: boolean;
}
/**
 * Cassis面のサイドバー。選択中の項目だけ Wasabi で塗る（§07）。
 * @startingPoint section="Navigation" subtitle="Cassis面のサイドバー（3階層）" viewport="700x400"
 */
export interface SidebarProps {
  brand?: React.ReactNode;
  /** 現在のHUB名（例: HR HUB） */
  hub?: React.ReactNode;
  /** 視点（スタッフ / 店長 / 本社・人事） */
  roleLabel?: React.ReactNode;
  items: SidebarItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  /** 最下部の本人表示 */
  footer?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Sidebar(props: SidebarProps): React.JSX.Element;
