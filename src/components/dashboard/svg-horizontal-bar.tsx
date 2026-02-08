'use client'

interface HorizontalBarData {
  label: string
  value: number
}

interface SvgHorizontalBarProps {
  data: HorizontalBarData[]
  width?: number
  height?: number
}

export function SvgHorizontalBar({
  data,
  width = 400,
  height = 200,
}: SvgHorizontalBarProps) {
  // Handle empty data or zero values
  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <text x={width / 2} y={height / 2} textAnchor="middle" style={{ fontSize: 12, fill: '#888' }}>
          データなし
        </text>
      </svg>
    )
  }

  const max = Math.max(...data.map((d) => d.value), 1) // Ensure max is at least 1
  const barHeight = 20
  const gap = 12
  const labelWidth = 120
  const chartWidth = width - labelWidth - 60

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const barWidth = (d.value / max) * chartWidth
        const y = i * (barHeight + gap)
        const opacity = 0.15 + (i / data.length) * 0.55

        return (
          <g key={i}>
            {/* Label */}
            <text
              x={labelWidth - 8}
              y={y + barHeight / 2 + 4}
              textAnchor="end"
              style={{
                fontSize: 11,
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                fill: '#555555',
              }}
            >
              {d.label.length > 12 ? d.label.slice(0, 12) + '...' : d.label}
            </text>
            {/* Bar */}
            <rect
              x={labelWidth}
              y={y}
              width={barWidth}
              height={barHeight}
              fill="#0a0a0a"
              opacity={opacity}
              rx={3}
            />
            {/* Value */}
            <text
              x={labelWidth + barWidth + 8}
              y={y + barHeight / 2 + 4}
              style={{
                fontSize: 11,
                fontFamily: "'Fraunces', serif",
                fill: '#0a0a0a',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 500,
              }}
            >
              {d.value >= 1000000
                ? (d.value / 1000000).toFixed(1) + 'M'
                : d.value >= 1000
                ? (d.value / 1000).toFixed(0) + 'K'
                : d.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
