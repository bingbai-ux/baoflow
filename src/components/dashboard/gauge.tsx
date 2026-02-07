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
  const dotX = size / 2 + radius * Math.cos(dotAngle)
  const dotY = size / 2 - radius * Math.sin(dotAngle)

  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox={`0 0 ${size} ${size * 0.65}`}
      style={{ display: 'block' }}
    >
      {/* Track */}
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke="#e8e8e6"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Tick marks */}
      {Array.from({ length: 21 }).map((_, i) => {
        const angle = Math.PI - (i / 20) * Math.PI
        const x1 = size / 2 + (radius + 8) * Math.cos(angle)
        const y1 = size / 2 - (radius + 8) * Math.sin(angle)
        const x2 = size / 2 + (radius + 12) * Math.cos(angle)
        const y2 = size / 2 - (radius + 12) * Math.sin(angle)
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
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke="#cccccc"
        strokeWidth={strokeWidth}
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
      />

      {/* End dot */}
      <circle cx={dotX} cy={dotY} r={5} fill="#22c55e" />
    </svg>
  )
}
