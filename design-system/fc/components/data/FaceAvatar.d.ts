import * as React from 'react';

/** 顔アイコン。Cool Blue面（D78）。写真がない前提で姓1文字を入れる。 */
export interface FaceAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 姓の1文字（例: 山） */
  children?: React.ReactNode;
  size?: number;
  /** 選択中。Orangeの輪郭 */
  selected?: boolean;
  /** 本人（ログイン中のユーザー）。Wasabi面 */
  highlight?: boolean;
}
export function FaceAvatar(props: FaceAvatarProps): React.JSX.Element;
