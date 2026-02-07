interface PipelineStage {
  stage: string
  count: number
}

interface PipelineBarProps {
  data: PipelineStage[]
}

export function PipelineBar({ data }: PipelineBarProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      {data.map((p, i) => {
        const pct = (p.count / total) * 100
        const isLast = i === data.length - 1
        const opacity = isLast ? 0.7 : 0.1 + i * 0.04

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: '#888888',
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                width: 60,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {p.stage}
            </span>
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: '#f2f2f0',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: isLast ? '#22c55e' : '#0a0a0a',
                  opacity,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                fontFamily: "'Fraunces', serif",
                color: '#555555',
                width: 20,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {p.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}
