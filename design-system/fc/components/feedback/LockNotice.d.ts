import * as React from 'react';

/** 権限・プライバシーで非表示にした理由を書く枠。伏せた事実を隠さず明示する。 */
export interface LockNoticeProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function LockNotice(props: LockNoticeProps): React.JSX.Element;
