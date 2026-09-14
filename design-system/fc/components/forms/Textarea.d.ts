import * as React from 'react';

/** 複数行入力。差し戻し理由・1on1メモなど。 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}
export function Textarea(props: TextareaProps): React.JSX.Element;
