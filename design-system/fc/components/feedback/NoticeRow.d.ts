import * as React from 'react';

/**
 * お知らせ・連絡ノートの1行。Card padded={false} の中に並べる。
 * @startingPoint section="Feedback" subtitle="お知らせ行・空状態・権限" viewport="700x260"
 */
export interface NoticeRowProps {
  /** 「重要」「未読」など。無ければ既読扱いの見た目に */
  badge?: React.ReactNode;
  title: React.ReactNode;
  date?: React.ReactNode;
  unread?: boolean;
  /** 最終行（下線を消す） */
  last?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function NoticeRow(props: NoticeRowProps): React.JSX.Element;
