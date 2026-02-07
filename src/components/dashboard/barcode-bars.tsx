'use client'

interface BarcodeBarsProps {
  data: number[]
  width?: number
  height?: number
  darkColor?: string
  highlightColor?: string
  highlightLast?: number
}

export function BarcodeBars({
  data,
  width = 160,
  height = 28,
  darkColor = '#0a0a0a',
  highlightColor = '#22c55e',
  highlightLast = 2,
}: BarcodeBarsProps) {
  const max = Math.max(...data)
  const barWidth = Math.max(1.5, (width - data.length * 0.8) / data.length)
  const gap = 0.8

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {data.map((value, i) => {
        const barHeight = Math.max(1, (value / max) * height)
        const isHighlight = i >= data.length - highlightLast
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            fill={isHighlight ? highlightColor : darkColor}
            opacity={isHighlight ? 1 : 0.12}
            rx={0.5}
          />
        )
      })}
    </svg>
  )
}
