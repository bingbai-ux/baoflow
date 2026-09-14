import * as React from 'react';

/**
 * ブランド表記。ロゴ画像は未支給のため文字ピルで代用する（readme.md の ICONOGRAPHY 参照）。
 * Wasabi の「1画面1点」の数には含めない固定要素。
 */
export interface BrandPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}
export function BrandPill(props: BrandPillProps): React.JSX.Element;
