import * as React from 'react';

/**
 * 主要ボタン。tone="main"（Wasabi）は「次にやること」1点だけに使う。
 * @startingPoint section="Core" subtitle="ボタン4種と丸ボタン" viewport="700x150"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** main=Wasabi(1画面1つ) / dark=Cassis / ghost=白+線 / danger=取り下げ・削除 */
  tone?: 'main' | 'dark' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}
export function Button(props: ButtonProps): React.JSX.Element;
