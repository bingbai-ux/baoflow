'use client'

export function InsightBanner() {
  const floatingCards = [
    { top: -10, right: 40, rotate: '2deg', opacity: 0.35, z: 1 },
    { top: 5, right: 80, rotate: '-3deg', opacity: 0.25, z: 0 },
    { top: -5, right: 10, rotate: '5deg', opacity: 0.2, z: 2 },
  ]

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        height: 185,
        background:
          'linear-gradient(140deg, rgba(34,197,94,0.22) 0%, rgba(34,197,94,0.40) 35%, rgba(22,163,74,0.28) 60%, rgba(34,197,94,0.12) 100%)',
      }}
    >
      {/* Floating glass cards */}
      {floatingCards.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: c.top,
            right: c.right,
            width: 200,
            height: 140,
            borderRadius: 16,
            background: `rgba(255,255,255,${c.opacity})`,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.35)',
            transform: `rotate(${c.rotate})`,
            zIndex: c.z,
          }}
        >
          <div style={{ padding: '14px 16px' }}>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(0,0,0,0.3)',
                fontFamily: "'Fraunces', serif",
              }}
            >
              ...mation
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(0,0,0,0.25)',
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                marginTop: 4,
              }}
            >
              ...savings
            </div>
          </div>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="2"
            style={{ position: 'absolute', top: 12, right: 12 }}
          >
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </div>
      ))}

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 5, padding: '26px 30px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 18,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1l2.2 4.4 4.8.7-3.5 3.4.8 4.8L8 11.8l-4.3 2.5.8-4.8-3.5-3.4 4.8-.7z"
              fill="#15803d"
            />
          </svg>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#15803d',
              fontFamily: "'Fraunces', serif",
            }}
          >
            Account Insights
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#15803d"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ marginLeft: 4 }}
          >
            <path d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        </div>
        <p
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: '#0a0a0a',
            lineHeight: 1.32,
            margin: 0,
            fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            maxWidth: 360,
          }}
        >
          先月の自動化で処理時間を{' '}
          <span
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              fontSize: 28,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            48.3
          </span>{' '}
          時間短縮
        </p>
      </div>

      {/* Carousel dots */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 30,
          display: 'flex',
          gap: 6,
          zIndex: 5,
        }}
      >
        <span
          style={{
            width: 22,
            height: 4,
            borderRadius: 2,
            background: 'rgba(0,0,0,0.45)',
          }}
        />
        <span
          style={{
            width: 8,
            height: 4,
            borderRadius: 2,
            background: 'rgba(0,0,0,0.12)',
          }}
        />
        <span
          style={{
            width: 8,
            height: 4,
            borderRadius: 2,
            background: 'rgba(0,0,0,0.12)',
          }}
        />
      </div>
    </div>
  )
}
