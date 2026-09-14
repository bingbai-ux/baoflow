import * as React from 'react';

/**
 * コンテンツ切替のファイルタブ（D80）。絞り込みには使わない。
 * @startingPoint section="Core" subtitle="ファイルタブ + パネル" viewport="700x200"
 */
export interface FileTabsProps {
  tabs: string[];
  value: string;
  onChange?: (tab: string) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function FileTabs(props: FileTabsProps): React.JSX.Element;
