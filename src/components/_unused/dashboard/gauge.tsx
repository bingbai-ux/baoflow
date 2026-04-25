'use client'

interface GaugeProps {
  value: number
  size?: number
}

export function Gauge({ value = 72, size = 120 }: GaugeProps) {
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = Math.PI * radius
  const filled = circumference * (value / 100)
  const dotAngle = Math.PI * (1 - value / 100)
  const dotX = Number((size / 2 + radius * Math.cos(dotAngle)).toFixed(6))
  const dotY = Number((size / 2 - radius * Math.sin(dotAngle)).toFixed(6))

  const halfStroke = Number((strokeWidth / 2).toFixed(6))
  const halfSize = Number((size / 2).toFixed(6))
  const endX = Number((size - strokeWidth / 2).toFixed(6))
  const svgHeight = Number((size * 0.6).toFixed(6))
  const viewBoxHeight = Number((size * 0.65).toFixed(6))

  return (
    <svg
      width={size}
      height={svgHeight}
      viewBox={`0 0 ${size} ${viewBoxHeight}`}
      style={{ display: 'block' }}
    >
      {/* Track */}
      <path
        d={`M ${halfStroke} ${halfSize} A ${radius} ${radius} 0 0 1 ${endX} ${halfSize}`}
        fill="none"
        stroke="#e8e8e6"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Tick marks */}
      {Array.from({ length: 21 }).map((_, i) => {
        const angle = Math.PI - (i / 20) * Math.PI
        const x1 = Number((size / 2 + (radius + 8) * Math.cos(angle)).toFixed(6))
        const y1 = Number((size / 2 - (radius + 8) * Math.sin(angle)).toFixed(6))
        const x2 = Number((size / 2 + (radius + 12) * Math.cos(angle)).toFixed(6))
        const y2 = Number((size / 2 - (radius + 12) * Math.sin(angle)).toFixed(6))
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#dddddd"
            strokeWidth={i % 5 === 0 ? 1.5 : 0.8}
          />
        )
      })}

      {/* Progress */}
      <path
        d={`M ${halfStroke} ${halfSize} A ${radius} ${radius} 0 0 1 ${endX} ${halfSize}`}
        fill="none"
        stroke="#cccccc"
        strokeWidth={strokeWidth}
        strokeDasharray={`${Number(filled.toFixed(6))} ${Number(circumference.toFixed(6))}`}
        strokeLinecap="round"
      />

      {/* End dot */}
      <circle cx={dotX} cy={dotY} r={5} fill="#22c55e" />
    </svg>
  )
}
