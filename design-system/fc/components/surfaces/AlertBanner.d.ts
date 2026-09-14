import * as React from 'react';

/** 期限・要対応の告知。1画面1本まで。 */
export interface AlertBannerProps {
  title: React.ReactNode;
  children?: React.ReactNode;
  /** 右端のボタン（ghost推奨） */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}
export function AlertBanner(props: AlertBannerProps): React.JSX.Element;
