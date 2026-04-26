// Variation 4: Notion DB-style Grouped Table by Client
// Collapsible client groups with rollup totals, full-width hairline rows, very compact

const v4Styles = {
  wrap: {
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
    color:'#0a0a0a',
    background:'#fff',
    border:'1px solid rgba(0,0,0,0.06)',
    borderRadius:14,
    overflow:'hidden',
    display:'flex', flexDirection:'column',
  },
  toolbar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'10px 14px', borderBottom:'1px solid rgba(0,0,0,0.06)',
  },
  body: { overflow:'auto', maxHeight:760 },
  groupHeader: (open) => ({
    display:'grid',
    gridTemplateColumns:'14px 220px 1fr 80px 110px 60px 130px 80px',
    gap:10, alignItems:'center',
    padding:'10px 14px',
    background:'#fafaf9',
    borderTop:'1px solid rgba(0,0,0,0.06)',
    borderBottom: open ? '1px solid rgba(0,0,0,0.06)' : 'none',
    cursor:'pointer',
    fontSize:11,
    position:'sticky', top:0, zIndex:1,
  }),
  groupName: {
    fontFamily:"'Fraunces', serif", fontWeight:600,
    fontSize:13, color:'#0a0a0a',
  },
  rollup: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:11, color:'#0a0a0a', textAlign:'right',
  },
  rollupSub: {
    fontSize:10, color:'#888', fontFamily:"'Zen Kaku Gothic New', sans-serif",
  },
  colHead: {
    display:'grid',
    gridTemplateColumns:'14px 220px 1fr 80px 110px 60px 130px 80px',
    gap:10, alignItems:'center',
    padding:'7px 14px',
    fontSize:9, color:'#bbb',
    textTransform:'uppercase', letterSpacing:'0.06em',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    background:'#fff',
  },
  row: (alert) => ({
    display:'grid',
    gridTemplateColumns:'14px 220px 1fr 80px 110px 60px 130px 80px',
    gap:10, alignItems:'center',
    padding:'7px 14px',
    height:30,
    fontSize:11, lineHeight:1.3,
    background: alert ? '#fffaf2' : '#fff',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    cursor:'pointer',
  }),
  num: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    textAlign:'right',
  },
  newSubtle: {
    padding:'7px 14px 9px 48px',
    fontSize:10, color:'#bbb',
    cursor:'pointer',
    background:'#fff',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
  },
};

function V4Grouped() {
  const [openGroups, setOpenGroups] = React.useState(() => new Set(window.CLIENTS.map(c => c.id)));
  const [filter, setFilter] = React.useState('all');

  const groups = React.useMemo(() => {
    let list = window.DEALS;
    if (filter === 'active') list = list.filter(d => d.status !== 'delivered');
    if (filter === 'urgent') list = list.filter(window.isUrgent);
    if (filter === 'stale') list = list.filter(window.isStale);

    const m = new Map();
    for (const d of list) {
      if (!m.has(d.client)) m.set(d.client, []);
      m.get(d.client).push(d);
    }
    return Array.from(m.entries()).map(([cid, deals]) => {
      deals.sort((a,b) => window.STATUS_ORDER.indexOf(a.status) - window.STATUS_ORDER.indexOf(b.status));
      return {
        cid,
        name: window.clientById(cid).name,
        deals,
        total: deals.reduce((s,d) => s + d.total_jpy, 0),
        active: deals.filter(d => d.status !== 'delivered').length,
        avgProfit: deals.reduce((s,d) => s + d.profit_pct, 0) / deals.length,
      };
    }).sort((a,b) => b.total - a.total);
  }, [filter]);

  const toggle = (cid) => {
    const next = new Set(openGroups);
    if (next.has(cid)) next.delete(cid); else next.add(cid);
    setOpenGroups(next);
  };

  const toggleAll = () => {
    if (openGroups.size === groups.length) setOpenGroups(new Set());
    else setOpenGroups(new Set(groups.map(g => g.cid)));
  };

  return (
    <div style={v4Styles.wrap}>
      <div style={v4Styles.toolbar}>
        <div style={{ display:'flex', gap:2 }}>
          {[['all','すべて'],['active','進行中'],['urgent','納期'],['stale','停滞']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{
                padding:'5px 12px', borderRadius:9999, fontSize:12, border:'none', cursor:'pointer',
                background: filter===k ? '#0a0a0a' : 'transparent',
                color: filter===k ? '#fff' : '#888',
                fontFamily: filter===k ? "'Fraunces', serif" : 'inherit',
                fontWeight: filter===k ? 600 : 400,
              }}>{l}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={toggleAll}
            style={{ background:'#fff', color:'#555', border:'1px solid #e8e8e6', borderRadius:8, padding:'5px 11px', fontSize:11, cursor:'pointer' }}>
            {openGroups.size === groups.length ? 'すべて閉じる' : 'すべて開く'}
          </button>
          <button style={{ background:'#0a0a0a', color:'#fff', borderRadius:8, padding:'5px 12px', fontSize:12, border:'none', cursor:'pointer', fontWeight:500 }}>
            + 新規案件
          </button>
        </div>
      </div>

      <div style={v4Styles.body}>
        {groups.map(g => {
          const open = openGroups.has(g.cid);
          return (
            <React.Fragment key={g.cid}>
              <div style={v4Styles.groupHeader(open)} onClick={() => toggle(g.cid)}>
                <span style={{ fontSize:9, color:'#888', transform: open ? 'rotate(90deg)' : 'none', transition:'transform .15s' }}>▶</span>
                <span style={v4Styles.groupName}>{g.name}</span>
                <span style={v4Styles.rollupSub}>
                  <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', color:'#0a0a0a' }}>{g.deals.length}</span> 件
                  ・進行中 <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', color:'#0a0a0a' }}>{g.active}</span>
                  ・平均粗利 <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', color:'#0a0a0a' }}>{g.avgProfit.toFixed(1)}%</span>
                </span>
                <span style={v4Styles.rollup}>{g.deals.reduce((s,d) => s + d.qty, 0).toLocaleString()}</span>
                <span style={{ ...v4Styles.rollup, fontWeight:600, fontSize:12 }}>{window.fmtJPY(g.total)}</span>
                <span></span><span></span><span></span>
              </div>
              {open && (
                <>
                  <div style={v4Styles.colHead}>
                    <span></span>
                    <span>案件名</span>
                    <span>仕様</span>
                    <span style={{ textAlign:'right' }}>数量</span>
                    <span style={{ textAlign:'right' }}>請求合計</span>
                    <span style={{ textAlign:'right' }}>粗利</span>
                    <span>ステータス</span>
                    <span style={{ textAlign:'right' }}>納期</span>
                  </div>
                  {g.deals.map(d => {
                    const stale = window.isStale(d);
                    const urgent = window.isUrgent(d);
                    const dUntil = window.daysUntil(d.delivery);
                    return (
                      <div key={d.id} style={v4Styles.row(stale || urgent)}>
                        <window.StatusDot status={d.status} />
                        <div style={{ minWidth:0, overflow:'hidden' }}>
                          <div style={{ display:'flex', gap:6, alignItems:'baseline' }}>
                            <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', color:'#888', fontSize:9 }}>{d.id}</span>
                            <span style={{ fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                            {urgent && <span style={{ fontSize:8.5, color:'#e5a32e' }}>●</span>}
                            {stale && !urgent && <span style={{ fontSize:8.5, color:'#bbb' }}>●</span>}
                          </div>
                        </div>
                        <span style={{ color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.spec}</span>
                        <span style={v4Styles.num}>{d.qty.toLocaleString()}</span>
                        <span style={{ ...v4Styles.num, fontWeight:500 }}><window.MoneyHover jpy={d.total_jpy} usd={d.unit_usd} qty={d.qty} /></span>
                        <span style={{ ...v4Styles.num, color: d.profit_pct >= 35 ? '#15803d' : d.profit_pct >= 25 ? '#0a0a0a' : '#e5a32e' }}>{d.profit_pct.toFixed(1)}%</span>
                        <window.StatusPill status={d.status} />
                        <span style={{ ...v4Styles.num, color: dUntil < 14 ? '#e5a32e' : '#888' }}>{window.fmtDate(d.delivery)}</span>
                      </div>
                    );
                  })}
                  <div style={v4Styles.newSubtle}>+ {g.name} に案件を追加</div>
                </>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

window.V4Grouped = V4Grouped;
