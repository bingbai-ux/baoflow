import * as React from 'react';

/** 1行入力。placeholder は Sauge。 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 枠を Orange にする */
  invalid?: boolean;
}
export function Input(props: InputProps): React.JSX.Element;
