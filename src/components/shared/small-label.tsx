import { ReactNode } from 'react'

interface SmallLabelProps {
  children: ReactNode
}

export function SmallLabel({ children }: SmallLabelProps) {
  return (
    <span
      style={{
        fontSize: 11,
        color: '#888888',
        fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
        fontWeight: 400,
      }}
    >
      {children}
    </span>
  )
}
