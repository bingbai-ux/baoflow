import * as React from 'react';

/** 丸アイコンボタン（40px）。承認・コメントなど反復操作の近道。 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** main=Wasabi（主要） / alt=Cool Blue（補助） */
  tone?: 'main' | 'alt';
  /** aria-label と title に入る説明。必須。 */
  label: string;
  children?: React.ReactNode;
}
export function IconButton(props: IconButtonProps): React.JSX.Element;
