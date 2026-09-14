import * as React from 'react';

/** 説明・ヒント・AIのきづき用の Wasabi カード（D79）。数値の羅列には使わない。 */
export interface NoteCardProps {
  title?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function NoteCard(props: NoteCardProps): React.JSX.Element;
