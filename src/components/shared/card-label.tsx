import { ReactNode } from 'react'

interface CardLabelProps {
  icon?: ReactNode
  children: ReactNode
}

export function CardLabel({ icon, children }: CardLabelProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 0,
      }}
    >
      {icon && (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </span>
      )}
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: '#888888',
          fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
        }}
      >
        {children}
      </span>
    </div>
  )
}
