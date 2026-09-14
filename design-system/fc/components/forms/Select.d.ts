import * as React from 'react';

export interface SelectOption { value: string; label: string }
/** ドロップダウン。選択肢が6件以上のときに使う。 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: (string | SelectOption)[];
  invalid?: boolean;
}
export function Select(props: SelectProps): React.JSX.Element;
