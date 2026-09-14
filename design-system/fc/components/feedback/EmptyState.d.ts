import * as React from 'react';

/** 空状態。破線の枠＋行背景。イラストは使わない。 */
export interface EmptyStateProps {
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}
export function EmptyState(props: EmptyStateProps): React.JSX.Element;
