// Mobile view — case management on iPhone
// 3 screens: list (grouped by client) → deal detail → quick status change

const mbStyles = {
  app: { width:'100%', height:'100%', background:'#f2f2f0', display:'flex', flexDirection:'column', fontFamily:"'Zen Kaku Gothic New', sans-serif", color:'#0a0a0a', overflow:'hidden' },
  topbar: { background:'#fff', padding:'62px 16px 10px', borderBottom:'1px solid #f0f0ee', display:'flex', flexDirection:'column', gap:8 },
  brandRow: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  brand: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:18 },
  filterRow: { display:'flex', gap:6, overflowX:'auto', paddingBottom:2 },
  chip: { padding:'5px 11px', borderRadius:9999, fontSize:12, border:'1px solid #e8e8e6', background:'#fff', color:'#555', whiteSpace:'nowrap', flexShrink:0 },
  chipActive: { background:'#0a0a0a', color:'#fff', border:'1px solid #0a0a0a' },
  list: { flex:1, overflowY:'auto', padding:'8px 12px 80px' },
  groupHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 4px 8px' },
  groupName: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:13 },
  groupMeta: { fontSize:10, color:'#888', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' },
  card: { background:'#fff', borderRadius:12, padding:'12px 14px', marginBottom:8, boxShadow:'0 1px 0 rgba(0,0,0,0.03)', border:'1px solid rgba(0,0,0,0.04)' },
  cardTop: { display:'flex', alignItems:'center', gap:8, marginBottom:6 },
  dealId: { fontFamily:"'Fraunces', serif", fontSize:10, color:'#888', fontVariantNumeric:'tabular-nums' },
  dealName: { fontWeight:500, fontSize:14, lineHeight:1.4, marginBottom:4 },
  spec: { fontSize:11, color:'#888', marginBottom:10, lineHeight:1.5 },
  metrics: { display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 },
  amount: { fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:17, fontWeight:600 },
  amountSub: { fontSize:10, color:'#888', fontFamily:"'Fraunces', serif" },
  cardBottom: { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:10, color:'#888', borderTop:'1px solid #f5f5f4', paddingTop:8 },
  fab: { position:'absolute', bottom:24, right:20, width:56, height:56, borderRadius:'50%', background:'#0a0a0a', color:'#fff', border:'none', boxShadow:'0 6px 16px rgba(0,0,0,0.2)', fontSize:24, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 },
  bottomNav: { position:'absolute', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #f0f0ee', display:'flex', justifyContent:'space-around', padding:'8px 0 22px' },
  navItem: { display:'flex', flexDirection:'column', alignItems:'center', gap:3, fontSize:9, color:'#888', flex:1 },
  navItemActive: { color:'#0a0a0a' },
};

function MobileDeals() {
  const [filter, setFilter] = React.useState('all');
  const filtered = React.useMemo(() => {
    let r = window.DEALS;
    if (filter === 'urgent') r = r.filter(window.isUrgent);
    if (filter === 'stale') r = r.filter(window.isStale);
    if (filter === 'active') r = r.filter(d => d.status !== 'delivered');
    return r;
  }, [filter]);

  const groups = React.useMemo(() => {
    const m = new Map();
    for (const d of filtered) { if (!m.has(d.client)) m.set(d.client, []); m.get(d.client).push(d); }
    return Array.from(m.entries()).map(([cid, deals]) => ({
      cid, name: window.clientById(cid).name, deals,
      total: deals.reduce((s,d) => s + d.total_jpy, 0),
    })).sort((a,b) => b.total - a.total);
  }, [filtered]);

  return (
    <div style={mbStyles.app}>
      <div style={mbStyles.topbar}>
        <div style={mbStyles.brandRow}>
          <div style={mbStyles.brand}>案件管理</div>
          <div style={{ display:'flex', gap:14, color:'#888' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8h12M6 12h12M6 16h12"/></svg>
          </div>
        </div>
        <div style={mbStyles.filterRow}>
          {[['all','すべて'],['active','進行中'],['urgent','納期 ≤14日'],['stale','停滞']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ ...mbStyles.chip, ...(filter===k ? mbStyles.chipActive : {}) }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={mbStyles.list}>
        {groups.map(g => (
          <React.Fragment key={g.cid}>
            <div style={mbStyles.groupHeader}>
              <div style={mbStyles.groupName}>{g.name}</div>
              <div style={mbStyles.groupMeta}>{g.deals.length}件 · {window.fmtJPY(g.total)}</div>
            </div>
            {g.deals.map(d => {
              const urgent = window.isUrgent(d);
              const stale = window.isStale(d);
              const cfg = window.STATUS[d.status];
              return (
                <div key={d.id} style={mbStyles.card}>
                  <div style={mbStyles.cardTop}>
                    <span style={mbStyles.dealId}>{d.id}</span>
                    <window.StatusPill status={d.status} />
                    {urgent && <span style={{ fontSize:9, color:'#e5a32e', marginLeft:'auto' }}>● 納期</span>}
                    {stale && !urgent && <span style={{ fontSize:9, color:'#888', marginLeft:'auto' }}>● 停滞</span>}
                  </div>
                  <div style={mbStyles.dealName}>{d.name}</div>
                  <div style={mbStyles.spec}>{d.spec}</div>
                  <div style={mbStyles.metrics}>
                    <div>
                      <div style={mbStyles.amount}>{window.fmtJPY(d.total_jpy)}</div>
                      <div style={mbStyles.amountSub}>{d.qty.toLocaleString()}個 · {window.fmtUSDsmall(d.unit_usd)}/個</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:"'Fraunces', serif", fontSize:11, color: urgent ? '#e5a32e' : '#0a0a0a' }}>納期 {window.fmtDate(d.delivery)}</div>
                      <div style={{ fontSize:9, color:'#888', marginTop:2 }}>粗利 {d.profit_pct.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div style={mbStyles.cardBottom}>
                    <span>{d.factory} · {d.sales}</span>
                    <span style={{ color:'#bbb' }}>{d.variants.length}案 ›</span>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <button style={mbStyles.fab}>+</button>

      <div style={mbStyles.bottomNav}>
        <div style={{ ...mbStyles.navItem, ...mbStyles.navItemActive }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="5" width="16" height="3" rx="1"/><rect x="4" y="11" width="16" height="3" rx="1"/><rect x="4" y="17" width="16" height="3" rx="1"/></svg>
          <span>案件</span>
        </div>
        <div style={mbStyles.navItem}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v4M16 4v4M4 10h16"/></svg>
          <span>カレンダー</span>
        </div>
        <div style={mbStyles.navItem}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>
          <span>分析</span>
        </div>
        <div style={mbStyles.navItem}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
          <span>設定</span>
        </div>
      </div>
    </div>
  );
}

window.MobileDeals = MobileDeals;
