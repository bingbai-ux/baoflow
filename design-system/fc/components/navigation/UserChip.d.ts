import * as React from 'react';

/** Cassis面の上の本人表示（顔＋氏名＋所属）。 */
export interface UserChipProps {
  /** 姓の1文字 */
  face: React.ReactNode;
  name: React.ReactNode;
  role: React.ReactNode;
  style?: React.CSSProperties;
}
export function UserChip(props: UserChipProps): React.JSX.Element;
