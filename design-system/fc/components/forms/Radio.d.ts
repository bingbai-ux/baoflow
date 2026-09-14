import * as React from 'react';

/** ラジオ。同じ name でグループ化する。 */
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}
export function Radio(props: RadioProps): React.JSX.Element;
