import * as React from 'react';

/** チェックボックス。行の高さは44px（スマホのタップ領域）。 */
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}
export function Checkbox(props: CheckboxProps): React.JSX.Element;
