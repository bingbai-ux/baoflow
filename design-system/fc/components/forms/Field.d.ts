import * as React from 'react';

/**
 * 入力欄のラベル枠。エラー文は「何をすれば直るか」を書く。
 * @startingPoint section="Forms" subtitle="ラベル・必須・エラー・選択肢" viewport="700x260"
 */
export interface FieldProps {
  label: React.ReactNode;
  required?: boolean;
  /** 補助説明、またはエラー文 */
  help?: React.ReactNode;
  /** true でヘルプが Orange Ink に切り替わる */
  error?: boolean;
  htmlFor?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Field(props: FieldProps): React.JSX.Element;
