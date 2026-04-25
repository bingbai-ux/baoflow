// Dashboard / summary view
// Composition: KPI strip · status pipeline funnel · attention list · top clients · recent activity
// Style vocabulary matches v1–v5: Fraunces tabular nums, hairline rows, alert tint #fffaf2,
// status dot colors from STATUS, body bg #f2f2f0, card bg #fff.

const dashStyles = {
  page: {
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
    color:'#0a0a0a',
    background:'#f2f2f0',
    padding:'18px 20px 24px',
    minHeight:'100%',
  },

  // header
  header: {
    display:'flex', alignItems:'flex-end', justifyContent:'space-between',
    marginBottom:16,
  },
  hTitle: {
    fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:22,
    letterSpacing:'-0.01em',
  },
  hSub: { fontSize:11, color:'#888', marginTop:2 },
  hRight: { display:'flex', alignItems:'center', gap:8 },
  segment: {
    display:'flex', background:'#fff', borderRadius:8,
    border:'1px solid rgba(0,0,0,0.06)', overflow:'hidden',
    fontSize:11,
  },
  segItem: (active) => ({
    padding:'6px 12px', cursor:'pointer',
    background: active ? '#0a0a0a' : '#fff',
    color: active ? '#fff' : '#555',
    fontWeight: active ? 500 : 400,
  }),
  iconBtn: {
    width:30, height:30, borderRadius:8, display:'flex',
    alignItems:'center', justifyContent:'center',
    background:'#fff', border:'1px solid rgba(0,0,0,0.06)',
    cursor:'pointer', color:'#555',
  },

  // KPI strip
  kpiRow: {
    display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:14,
  },
  kpi: {
    background:'#fff', borderRadius:12,
    border:'1px solid rgba(0,0,0,0.06)',
    padding:'14px 16px',
    display:'flex', flexDirection:'column', gap:6,
  },
  kpiLabel: {
    fontSize:10, color:'#888',
    textTransform:'uppercase', letterSpacing:'0.08em',
  },
  kpiValue: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:28, fontWeight:500, lineHeight:1, marginTop:2,
  },
  kpiUnit: {
    fontFamily:"'Fraunces', serif", fontSize:14, color:'#888', marginLeft:3,
  },
  kpiDelta: (up) => ({
    fontSize:10, color: up ? '#22c55e' : '#cf5a3a',
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    display:'inline-flex', alignItems:'center', gap:3,
  }),
  kpiSub: { fontSize:10, color:'#888' },
  spark: { marginTop:'auto' },

  // Two-col body
  body: {
    display:'grid', gridTemplateColumns:'1fr 1fr', gap:10,
  },
  bodyTop: {
    display:'grid', gridTemplateColumns:'2fr 1fr', gap:10, marginBottom:10,
  },

  card: {
    background:'#fff', borderRadius:12,
    border:'1px solid rgba(0,0,0,0.06)',
    padding:'14px 16px',
    display:'flex', flexDirection:'column',
  },
  cardHead: {
    display:'flex', alignItems:'baseline', justifyContent:'space-between',
    marginBottom:10,
  },
  cardTitle: {
    fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:13,
  },
  cardMeta: { fontSize:10, color:'#888' },
  cardLink: {
    fontSize:10, color:'#0a0a0a', cursor:'pointer',
    borderBottom:'1px solid #0a0a0a', paddingBottom:1,
  },

  // Pipeline (status funnel)
  pipeRow: {
    display:'grid', gridTemplateColumns:'70px 1fr 60px 90px',
    gap:10, alignItems:'center', padding:'7px 0',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    fontSize:11,
  },
  pipeLabelWrap: {
    display:'flex', alignItems:'center', gap:6,
  },
  pipeBarTrack: {
    height:18, background:'#f4f4f1', borderRadius:3, position:'relative',
    overflow:'hidden',
  },
  pipeBarFill: (color, pct) => ({
    height:'100%', width: `${pct}%`,
    background: color,
    opacity: 0.85,
  }),
  pipeCount: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:13, textAlign:'right',
  },
  pipeAmt: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:11, textAlign:'right', color:'#555',
  },

  // Attention list
  attRow: {
    display:'grid',
    gridTemplateColumns:'14px 1fr 90px 80px 80px',
    gap:8, alignItems:'center', padding:'7px 0',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    fontSize:11,
  },
  attTag: (kind) => ({
    fontSize:9, padding:'2px 5px', borderRadius:3,
    background: kind==='urgent' ? '#fef0e6' : '#f4f4f1',
    color: kind==='urgent' ? '#cf5a3a' : '#555',
    fontWeight:500, letterSpacing:'0.02em',
    whiteSpace:'nowrap',
  }),
  attName: {
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  attClient: { fontSize:10, color:'#888' },
  attDays: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:11, textAlign:'right',
  },

  // Top clients
  cliRow: {
    display:'grid',
    gridTemplateColumns:'1fr 50px 1fr 90px',
    gap:10, alignItems:'center', padding:'8px 0',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    fontSize:11,
  },
  cliName: {
    fontFamily:"'Fraunces', serif", fontWeight:500, fontSize:12,
  },
  cliCount: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:11, color:'#555', textAlign:'right',
  },
  cliBarTrack: {
    height:6, background:'#f4f4f1', borderRadius:3, overflow:'hidden',
  },
  cliBarFill: (pct) => ({ height:'100%', width:`${pct}%`, background:'#0a0a0a' }),
  cliAmt: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:11, textAlign:'right',
  },

  // Activity
  actRow: {
    display:'grid', gridTemplateColumns:'52px 1fr',
    gap:10, padding:'8px 0',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    fontSize:11,
  },
  actDate: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:11, color:'#888',
  },
  actBody: { lineHeight:1.5 },
  actName: { fontWeight:500 },
  actMeta: { fontSize:10, color:'#888', marginTop:2 },
};

// Tiny inline sparkline (no deps)
function Sparkline({ data, color='#0a0a0a', width=120, height=28 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${path} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} style={{ display:'block' }}>
      <path d={area} fill={color} opacity={0.07} />
      <path d={path} stroke={color} strokeWidth={1.4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
    </svg>
  );
}

function KPICard({ label, value, unit, delta, sub, spark, sparkColor }) {
  return (
    <div style={dashStyles.kpi}>
      <div style={dashStyles.kpiLabel}>{label}</div>
      <div>
        <span style={dashStyles.kpiValue}>{value}</span>
        {unit && <span style={dashStyles.kpiUnit}>{unit}</span>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {delta && (
          <span style={dashStyles.kpiDelta(delta.up)}>
            {delta.up ? '▲' : '▼'} {delta.text}
          </span>
        )}
        {sub && <span style={dashStyles.kpiSub}>{sub}</span>}
      </div>
      {spark && <div style={dashStyles.spark}><Sparkline data={spark} color={sparkColor || '#0a0a0a'} width={260} height={36} /></div>}
    </div>
  );
}

function Dashboard() {
  // === aggregates ===
  const totalDeals = DEALS.length;
  const activeDeals = DEALS.filter(d => d.status !== 'delivered');
  const totalActiveAmt = activeDeals.reduce((s,d) => s + d.total_jpy, 0);
  const deliveredThisMonth = DEALS.filter(d => d.status === 'delivered'); // mock all
  const billedThisMonth = deliveredThisMonth.reduce((s,d) => s + d.total_jpy, 0);
  const avgProfit = +(DEALS.reduce((s,d) => s + d.profit_pct, 0) / DEALS.length).toFixed(1);
  const urgentCount = DEALS.filter(isUrgent).length;
  const staleCount = DEALS.filter(isStale).length;
  const attentionCount = DEALS.filter(d => isUrgent(d) || isStale(d)).length;

  // pipeline by status
  const byStatus = STATUS_ORDER.map(s => {
    const list = DEALS.filter(d => d.status === s);
    return {
      key: s,
      label: STATUS[s].label,
      color: STATUS[s].dot,
      count: list.length,
      amt: list.reduce((sum,d) => sum + d.total_jpy, 0),
    };
  });
  const maxStatusCount = Math.max(...byStatus.map(s => s.count));

  // top clients (by total active amount)
  const clientAgg = CLIENTS.map(c => {
    const list = DEALS.filter(d => d.client === c.id);
    const active = list.filter(d => d.status !== 'delivered');
    return {
      ...c,
      total: list.reduce((s,d) => s + d.total_jpy, 0),
      activeCount: active.length,
      totalCount: list.length,
    };
  }).sort((a,b) => b.total - a.total);
  const maxClientTotal = Math.max(...clientAgg.map(c => c.total));

  // attention list (urgent + stale, sorted by urgency)
  const attention = DEALS
    .map(d => {
      const urgent = isUrgent(d);
      const stale = isStale(d);
      return urgent || stale ? {
        ...d,
        urgent, stale,
        daysToDelivery: daysUntil(d.delivery),
        daysSinceUpd: daysSince(d.updated),
      } : null;
    })
    .filter(Boolean)
    .sort((a,b) => {
      // most-urgent first: smallest daysToDelivery wins; staleness as tiebreaker
      const av = a.urgent ? a.daysToDelivery : 999;
      const bv = b.urgent ? b.daysToDelivery : 999;
      if (av !== bv) return av - bv;
      return b.daysSinceUpd - a.daysSinceUpd;
    })
    .slice(0, 7);

  // recent activity (latest updates)
  const activity = [...DEALS]
    .sort((a,b) => b.updated.localeCompare(a.updated))
    .slice(0, 8)
    .map(d => {
      const cli = clientById(d.client);
      // synthesize an activity verb based on status
      const verb = ({
        quoting:'見積を作成', quote_confirmed:'見積確定', paid:'入金確認',
        data_confirmed:'データ確認完了', in_production:'製作開始',
        shipped:'工場発送', delivered:'納品完了',
      })[d.status];
      return { ...d, cli, verb };
    });

  // mock sparkline data — last 12 weeks revenue trend
  const sparkAmt = [180, 205, 198, 240, 232, 285, 270, 310, 295, 340, 360, 395];
  const sparkProfit = [31, 30, 33, 32, 35, 34, 36, 35, 37, 36, 38, 37];

  return (
    <div style={dashStyles.page}>
      {/* Header */}
      <div style={dashStyles.header}>
        <div>
          <div style={dashStyles.hTitle}>ダッシュボード</div>
          <div style={dashStyles.hSub}>2026年 4月25日 (土) · 田中 のサマリ</div>
        </div>
        <div style={dashStyles.hRight}>
          <div style={dashStyles.segment}>
            <div style={dashStyles.segItem(false)}>今週</div>
            <div style={dashStyles.segItem(true)}>今月</div>
            <div style={dashStyles.segItem(false)}>四半期</div>
            <div style={dashStyles.segItem(false)}>YTD</div>
          </div>
          <div style={dashStyles.iconBtn} title="エクスポート">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
            </svg>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={dashStyles.kpiRow}>
        <KPICard
          label="進行中の案件"
          value={activeDeals.length}
          unit="件"
          delta={{ up:true, text:'+3 今週' }}
          sub={`全${totalDeals}件中`}
          spark={[10,11,12,11,13,14,13,14,15,14,15, activeDeals.length]}
        />
        <KPICard
          label="進行中の総額"
          value={'¥' + (totalActiveAmt/1000000).toFixed(1)}
          unit="M"
          delta={{ up:true, text:'+12.3%' }}
          sub="前月比"
          spark={sparkAmt}
        />
        <KPICard
          label="今月 請求済"
          value={'¥' + (billedThisMonth/1000000).toFixed(2)}
          unit="M"
          delta={{ up:true, text:'+8.1%' }}
          sub={`${deliveredThisMonth.length}件 納品完了`}
          spark={[1.0,1.2,0.9,1.4,1.1,1.5,1.3,1.7,1.5,1.8,2.0,billedThisMonth/1000000]}
          sparkColor="#22c55e"
        />
        <KPICard
          label="平均粗利率"
          value={avgProfit}
          unit="%"
          delta={{ up:true, text:'+1.2pt' }}
          sub="目標 35.0%"
          spark={sparkProfit}
          sparkColor="#e5a32e"
        />
      </div>

      {/* Body — top row: pipeline (wide) + attention (narrow) */}
      <div style={dashStyles.bodyTop}>
        {/* Pipeline */}
        <div style={dashStyles.card}>
          <div style={dashStyles.cardHead}>
            <div style={dashStyles.cardTitle}>パイプライン</div>
            <div style={dashStyles.cardMeta}>ステータス別 案件数 / 金額</div>
          </div>
          <div>
            <div style={{ ...dashStyles.pipeRow, borderBottom:'1px solid rgba(0,0,0,0.06)', paddingBottom:5,
              fontSize:9, color:'#bbb', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              <div>段階</div>
              <div></div>
              <div style={{ textAlign:'right' }}>件数</div>
              <div style={{ textAlign:'right' }}>金額</div>
            </div>
            {byStatus.map(s => (
              <div key={s.key} style={dashStyles.pipeRow}>
                <div style={dashStyles.pipeLabelWrap}>
                  <StatusDot status={s.key} size={6} />
                  <span style={{ fontSize:11 }}>{s.label}</span>
                </div>
                <div style={dashStyles.pipeBarTrack}>
                  <div style={dashStyles.pipeBarFill(s.color, (s.count / maxStatusCount) * 100)} />
                </div>
                <div style={dashStyles.pipeCount}>{s.count}</div>
                <div style={dashStyles.pipeAmt}>{s.amt > 0 ? '¥' + (s.amt/1000).toFixed(0) + 'k' : '—'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Attention */}
        <div style={dashStyles.card}>
          <div style={dashStyles.cardHead}>
            <div style={dashStyles.cardTitle}>要対応 ({attentionCount})</div>
            <div style={dashStyles.cardLink}>すべて見る</div>
          </div>
          <div>
            {attention.map(d => (
              <div key={d.id} style={dashStyles.attRow}>
                <StatusDot status={d.status} size={5} />
                <div>
                  <div style={dashStyles.attName}>{d.name}</div>
                  <div style={dashStyles.attClient}>{clientById(d.client).short} · {d.id}</div>
                </div>
                <div>
                  {d.urgent && <span style={dashStyles.attTag('urgent')}>納期 {d.daysToDelivery}日</span>}
                  {!d.urgent && d.stale && <span style={dashStyles.attTag('stale')}>停滞 {d.daysSinceUpd}日</span>}
                </div>
                <div style={dashStyles.attDays}>{d.sales}</div>
                <div style={{ ...dashStyles.attDays, color:'#888', fontSize:10 }}>{fmtDate(d.delivery)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body — bottom row: top clients + activity */}
      <div style={dashStyles.body}>
        {/* Top clients */}
        <div style={dashStyles.card}>
          <div style={dashStyles.cardHead}>
            <div style={dashStyles.cardTitle}>クライアント別 取引額</div>
            <div style={dashStyles.cardMeta}>累計 (進行中 + 納品済)</div>
          </div>
          <div>
            <div style={{ ...dashStyles.cliRow, borderBottom:'1px solid rgba(0,0,0,0.06)',
              fontSize:9, color:'#bbb', textTransform:'uppercase', letterSpacing:'0.06em', padding:'5px 0' }}>
              <div>クライアント</div>
              <div style={{ textAlign:'right' }}>件数</div>
              <div></div>
              <div style={{ textAlign:'right' }}>累計</div>
            </div>
            {clientAgg.map(c => (
              <div key={c.id} style={dashStyles.cliRow}>
                <div>
                  <div style={dashStyles.cliName}>{c.name}</div>
                  <div style={{ fontSize:10, color:'#888' }}>進行中 {c.activeCount} / 全{c.totalCount}件</div>
                </div>
                <div style={dashStyles.cliCount}>{c.totalCount}</div>
                <div style={dashStyles.cliBarTrack}>
                  <div style={dashStyles.cliBarFill((c.total / maxClientTotal) * 100)} />
                </div>
                <div style={dashStyles.cliAmt}>¥{(c.total/1000).toFixed(0)}k</div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div style={dashStyles.card}>
          <div style={dashStyles.cardHead}>
            <div style={dashStyles.cardTitle}>最近の更新</div>
            <div style={dashStyles.cardLink}>履歴を開く</div>
          </div>
          <div>
            {activity.map(d => (
              <div key={d.id} style={dashStyles.actRow}>
                <div style={dashStyles.actDate}>{fmtDate(d.updated)}</div>
                <div style={dashStyles.actBody}>
                  <span style={dashStyles.actName}>{d.cli.short}</span>
                  <span style={{ color:'#888' }}> · </span>
                  <span>{d.name}</span>
                  <span style={{ color:'#888' }}> を </span>
                  <span style={{ fontWeight:500 }}>{d.verb}</span>
                  <div style={dashStyles.actMeta}>
                    <StatusDot status={d.status} size={4} />
                    <span style={{ marginLeft:5 }}>{STATUS[d.status].label} · {d.sales} · {d.id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });
