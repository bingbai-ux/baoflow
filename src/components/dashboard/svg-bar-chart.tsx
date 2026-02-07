'use client'

interface BarData {
  label: string
  value: number
}

interface SvgBarChartProps {
  data: BarData[]
  width?: number
  height?: number
  highlightIndex?: number
}

export function SvgBarChart({
  data,
  width = 400,
  height = 200,
  highlightIndex,
}: SvgBarChartProps) {
  const max = Math.max(...data.map((d) => d.value))
  const barWidth = (width - (data.length + 1) * 10) / data.length
  const chartHeight = height - 30 // Leave space for labels

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const barHeight = (d.value / max) * (chartHeight - 20)
        const x = 10 + i * (barWidth + 10)
        const y = chartHeight - barHeight
        const isHighlight = highlightIndex !== undefined ? i === highlightIndex : i === data.length - 1

        return (
          <g key={i}>
            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={isHighlight ? '#22c55e' : '#0a0a0a'}
              opacity={isHighlight ? 0.8 : 0.15}
              rx={3}
            />
            {/* Value on top */}
            <text
              x={x + barWidth / 2}
              y={y - 6}
              textAnchor="middle"
              style={{
                fontSize: 10,
                fontFamily: "'Fraunces', serif",
                fill: '#555555',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {(d.value / 1000000).toFixed(1)}M
            </text>
            {/* Label */}
            <text
              x={x + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
              style={{
                fontSize: 10,
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                fill: '#888888',
              }}
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
