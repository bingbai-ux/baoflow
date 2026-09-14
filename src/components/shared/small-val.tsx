import { ReactNode } from 'react'

interface SmallValProps {
  children: ReactNode
}

export function SmallVal({ children }: SmallValProps) {
  return (
    <span
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: '#351E28',
        fontFamily: "'Fraunces', serif",
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </span>
  )
}
