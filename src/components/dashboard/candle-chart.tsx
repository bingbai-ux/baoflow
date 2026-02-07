'use client'

interface CandleData {
  h: number // high
  l: number // low
  o: number // open
  c: number // close
}

interface CandleChartProps {
  data: CandleData[]
  width?: number
  height?: number
}

export function CandleChart({ data, width = 260, height = 60 }: CandleChartProps) {
  const max = Math.max(...data.map((d) => d.h))
  const min = Math.min(...data.map((d) => d.l))
  const range = max - min || 1
  const barWidth = Math.max(1, (width - data.length * 1.5) / data.length)

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const x = i * (barWidth + 1.5)
        const yH = height - ((d.h - min) / range) * (height - 4) - 2
        const yL = height - ((d.l - min) / range) * (height - 4) - 2
        const yO = height - ((d.o - min) / range) * (height - 4) - 2
        const yC = height - ((d.c - min) / range) * (height - 4) - 2
        const isUp = d.c >= d.o

        return (
          <g key={i}>
            {/* Wick */}
            <line
              x1={x + barWidth / 2}
              y1={yH}
              x2={x + barWidth / 2}
              y2={yL}
              stroke={isUp ? '#22c55e' : '#0a0a0a'}
              strokeWidth={0.8}
              opacity={0.4}
            />
            {/* Body */}
            <rect
              x={x}
              y={Math.min(yO, yC)}
              width={barWidth}
              height={Math.max(1, Math.abs(yC - yO))}
              fill={isUp ? '#22c55e' : '#0a0a0a'}
              opacity={isUp ? 0.7 : 0.15}
              rx={0.3}
            />
          </g>
        )
      })}
    </svg>
  )
}
