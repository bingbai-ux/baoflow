import * as React from 'react';

/** 白い器。表やリストを入れるときは padded={false}。 */
export interface CardProps {
  title?: React.ReactNode;
  /** 見出し右のボタン等 */
  action?: React.ReactNode;
  /** 中身に16pxの余白をつける。表・行リストでは false。 */
  padded?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Card(props: CardProps): React.JSX.Element;
