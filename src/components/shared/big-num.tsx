interface BigNumProps {
  integer: string
  decimal?: string
  unit?: string
  size?: number
}

export function BigNum({ integer, decimal, unit = '%', size = 44 }: BigNumProps) {
  return (
    <div
      style={{
        fontFamily: "'Fraunces', serif",
        fontWeight: 500,
        fontSize: size,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        color: '#0a0a0a',
        display: 'flex',
        alignItems: 'flex-start',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {integer}
      {decimal && (
        <span style={{ fontSize: size * 0.5, letterSpacing: 0 }}>
          ,{decimal}
        </span>
      )}
      {unit && (
        <span
          style={{
            fontSize: size * 0.3,
            fontWeight: 400,
            color: '#888888',
            marginTop: 2,
            marginLeft: 1,
          }}
        >
          {unit}
        </span>
      )}
    </div>
  )
}
