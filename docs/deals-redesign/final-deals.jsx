// Final integrated Deals page — combines table view + right-pane (always-on)
// Uses v5-nested-style data model but with integrated pane interaction.

const fdStyles = {
  wrap: { flex:1, display:'flex', flexDirection:'column', minWidth:0, background:'#fff' },

  // Filter bar
  filters: { padding:'10px 20px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', gap:8, fontSize:11.5, flexShrink:0, flexWrap:'wrap' },
  filterChip: { padding:'5px 10px', border:'1px solid #e0dfd9', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:11, color:'#555', display:'inline-flex', alignItems:'center', gap:5 },
  filterChipActive: { background:'#0a0a0a', color:'#fff', border:'1px solid #0a0a0a' },
  filterDot: { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  filterSpacer: { flex:1 },
  filterMeta: { color:'#888', fontSize:11 },

  // Table
  scroll: { flex:1, overflow:'auto', padding:'0 20px 80px' },
  table: { width:'100%', borderCollapse:'separate', borderSpacing:0, fontSize:11.5 },
  th: { textAlign:'left', padding:'10px 8px', fontSize:9.5, fontWeight:600, color:'#888', letterSpacing:'0.06em', textTransform:'uppercase', borderBottom:'1px solid #e8e8e6', position:'sticky', top:0, background:'#fff', zIndex:5, fontFamily:"'Fraunces', serif" },
  thNum: { textAlign:'right' },
  thCenter: { textAlign:'center' },

  clientHead: { background:'#fafaf9' },
  clientCell: { padding:'10px 8px', fontSize:12, fontWeight:600, color:'#0a0a0a', cursor:'pointer', display:'flex', alignItems:'center', gap:6 },
  clientCount: { fontSize:9.5, color:'#888', fontFamily:"'Fraunces', serif", fontWeight:500, marginLeft:6 },
  rollup: { padding:'10px 8px', textAlign:'right', fontSize:10.5, color:'#888', fontFamily:"'Fraunces', serif" },
  rollupNum: { color:'#0a0a0a', fontWeight:500 },

  dealRow: { cursor:'pointer', borderBottom:'1px solid #f5f4f0' },
  dealRowActive: { background:'#fff8e8' },
  dealRowHover: { background:'#fafaf9' },
  td: { padding:'8px', verticalAlign:'middle', borderBottom:'1px solid #f5f4f0' },
  tdNum: { textAlign:'right', fontFamily:"'Fraunces', serif", fontWeight:500 },
  tdCenter: { textAlign:'center' },
  tdMuted: { color:'#888' },
  tdId: { fontFamily:"'Fraunces', serif", fontSize:10.5, color:'#888', letterSpacing:'0.04em' },

  thumb: { width:32, height:32, borderRadius:5, flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:9, fontFamily:"'Fraunces', serif", fontWeight:600, color:'#0a0a0a', verticalAlign:'middle' },
  nameWithThumb: { display:'flex', alignItems:'center', gap:8 },

  chev: { display:'inline-block', width:14, textAlign:'center', color:'#aaa', fontSize:9, marginRight:2, transition:'transform 0.15s', cursor:'pointer' },
  chevOpen: { transform:'rotate(90deg)', color:'#0a0a0a' },

  variantHead: { background:'#fcfbf9' },
  variantTd: { padding:'7px 8px', fontSize:10.5, color:'#666', borderBottom:'1px solid #faf9f5' },
  variantNote: { fontSize:9.5, color:'#888', fontFamily:"'Fraunces', serif", marginRight:4 },
  variantAdoptBtn: { fontSize:9.5, padding:'2px 6px', border:'1px solid #e0dfd9', background:'#fff', borderRadius:3, cursor:'pointer', color:'#666', fontFamily:'inherit' },
  variantAdoptBtnActive: { background:'#0a0a0a', color:'#fff', border:'1px solid #0a0a0a' },

  pillStatus: { display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:10, fontSize:9.5, color:'#0a0a0a', background:'#fafaf9', border:'1px solid #ececea', cursor:'pointer', fontFamily:"'Fraunces', serif", fontWeight:500 },
  pillProfit: { padding:'2px 6px', borderRadius:3, fontSize:9.5, fontFamily:"'Fraunces', serif", fontWeight:600, color:'#0a0a0a' },

  alertBadge: { display:'inline-block', fontSize:9, padding:'1px 5px', borderRadius:3, background:'#fdeae3', color:'#c0392b', marginLeft:5, fontWeight:500 },
};

// Mini thumbnail derived from deal name (consistent color from hash)
function dealThumb(deal) {
  const colors = ['#e8d4b8','#d4c5a3','#c9d4c5','#b8c8d4','#d4b8c5','#c8b8d4','#b8d4c8','#e0d4b8'];
  let h = 0; for (let i = 0; i < deal.name.length; i++) h = (h * 31 + deal.name.charCodeAt(i)) % 100000;
  const c = colors[h % colors.length];
  const initial = deal.name.charAt(0);
  return { bg:c, initial };
}

function FinalDealsView({ selectedId, onSelect, ccy }) {
  const [openClients, setOpenClients] = React.useState(new Set(['c01','c02','c03','c04','c05','c06']));
  const [openDeals, setOpenDeals] = React.useState(new Set());
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [adopted, setAdopted] = React.useState(() => {
    const m = {};
    for (const d of window.DEALS) m[d.id] = 1; // index 1 = main variant
    return m;
  });

  const filtered = React.useMemo(() => statusFilter === 'all' ? window.DEALS : window.DEALS.filter(d => d.status === statusFilter), [statusFilter]);

  const groups = React.useMemo(() => {
    const m = new Map();
    for (const d of filtered) { if (!m.has(d.client)) m.set(d.client, []); m.get(d.client).push(d); }
    return m;
  }, [filtered]);

  const totalDeals = filtered.length;
  const inProg = filtered.filter(d => d.status !== 'delivered').length;
  const totalJpy = filtered.reduce((s,d) => s + d.total_jpy, 0);

  const toggleClient = (cid) => { const n = new Set(openClients); n.has(cid) ? n.delete(cid) : n.add(cid); setOpenClients(n); };
  const toggleDeal = (did, e) => { e.stopPropagation(); const n = new Set(openDeals); n.has(did) ? n.delete(did) : n.add(did); setOpenDeals(n); };

  const ccyDisplay = (jpy, usd) => {
    if (ccy === 'JPY') return <span>{window.fmtJPY(jpy)}</span>;
    if (ccy === 'USD') return <span>{window.fmtUSD(jpy / window.VARIANT_FX)}</span>;
    return <span>{window.fmtJPY(jpy)} <span style={{ fontSize:8.5, color:'#aaa' }}>/{window.fmtUSD(jpy / window.VARIANT_FX).replace('$','$')}</span></span>;
  };

  const cols = [
    { k:'id', label:'ID', w:88 },
    { k:'name', label:'案件名', w:240 },
    { k:'spec', label:'仕様', w:200 },
    { k:'qty', label:'数量', w:70, num:true },
    { k:'unit', label:'単価', w:70, num:true },
    { k:'total', label:'請求', w:100, num:true },
    { k:'profit', label:'粗利', w:60, num:true },
    { k:'status', label:'状態', w:78, center:true },
    { k:'delivery', label:'納期', w:60, center:true },
    { k:'factory', label:'工場', w:120 },
    { k:'sales', label:'担当', w:50 },
    { k:'updated', label:'更新', w:60 },
  ];

  return (
    <div style={fdStyles.wrap}>
      <div style={fdStyles.filters}>
        <button onClick={() => setStatusFilter('all')} style={{ ...fdStyles.filterChip, ...(statusFilter==='all' ? fdStyles.filterChipActive : {}) }}>すべて</button>
        {window.STATUS_ORDER.map(s => {
          const cfg = window.STATUS[s];
          const cnt = window.DEALS.filter(d => d.status === s).length;
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ ...fdStyles.filterChip, ...(statusFilter===s ? fdStyles.filterChipActive : {}) }}>
              <span style={{ ...fdStyles.filterDot, background:cfg.dot }}></span>
              {cfg.label} <span style={{ opacity:0.7, marginLeft:2 }}>{cnt}</span>
            </button>
          );
        })}
        <div style={fdStyles.filterSpacer}></div>
        <span style={fdStyles.filterMeta}>{totalDeals}件 / 進行中 {inProg} / 累計 {window.fmtJPY(totalJpy)}</span>
      </div>

      <div style={fdStyles.scroll}>
        <table style={fdStyles.table}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.k} style={{ ...fdStyles.th, ...(c.num ? fdStyles.thNum : {}), ...(c.center ? fdStyles.thCenter : {}), width:c.w }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...groups.entries()].map(([cid, deals]) => {
              const client = window.CLIENTS.find(c => c.id === cid);
              const open = openClients.has(cid);
              const subTotal = deals.reduce((s,d) => s + d.total_jpy, 0);
              return (
                <React.Fragment key={cid}>
                  {/* Client group header */}
                  <tr style={fdStyles.clientHead}>
                    <td colSpan={7} style={{ ...fdStyles.clientCell }} onClick={() => toggleClient(cid)}>
                      <span style={{ ...fdStyles.chev, ...(open ? fdStyles.chevOpen : {}) }}>▶</span>
                      <span>{client.name}</span>
                      <span style={fdStyles.clientCount}>{deals.length}件</span>
                    </td>
                    <td colSpan={5} style={fdStyles.rollup}>
                      累計 <span style={fdStyles.rollupNum}>{window.fmtJPY(subTotal)}</span>
                    </td>
                  </tr>

                  {open && deals.map(d => {
                    const stat = window.STATUS[d.status];
                    const dealOpen = openDeals.has(d.id);
                    const isSelected = selectedId === d.id;
                    const t = dealThumb(d);
                    const adoptIdx = adopted[d.id] ?? 1;
                    const variants = d.variants || [];
                    const due = new Date(d.delivery);
                    const daysLeft = Math.round((due - new Date('2026-04-26')) / 86400000);
                    const urgent = daysLeft >= 0 && daysLeft <= 14 && d.status !== 'delivered';

                    return (
                      <React.Fragment key={d.id}>
                        <tr style={{ ...fdStyles.dealRow, ...(isSelected ? fdStyles.dealRowActive : {}) }} onClick={() => onSelect(d)}>
                          <td style={{ ...fdStyles.td, ...fdStyles.tdId }}>
                            <span style={{ ...fdStyles.chev, ...(dealOpen ? fdStyles.chevOpen : {}) }} onClick={(e) => toggleDeal(d.id, e)}>▶</span>
                            {d.id}
                          </td>
                          <td style={fdStyles.td}>
                            <div style={fdStyles.nameWithThumb}>
                              <div style={{ ...fdStyles.thumb, background:t.bg }}>{t.initial}</div>
                              <div>
                                <div style={{ fontWeight:500, color:'#0a0a0a' }}>{d.name}</div>
                                <div style={{ fontSize:9.5, color:'#aaa', fontFamily:"'Fraunces', serif" }}>
                                  {variants.length}案 · 採用 v{adoptIdx === 0 ? '少量' : adoptIdx === 1 ? 'メイン' : '大量'}
                                  {urgent && <span style={fdStyles.alertBadge}>納期</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...fdStyles.td, ...fdStyles.tdMuted, fontSize:10.5 }} onClick={(e) => e.stopPropagation()}>
                            <window.EditField value={d.spec} onCommit={(v) => { d.spec = v; }} />
                          </td>
                          <td style={{ ...fdStyles.td, ...fdStyles.tdNum }} onClick={(e) => e.stopPropagation()}>
                            <window.EditField value={d.qty} type="number" onCommit={(v) => { d.qty = parseInt(v)||0; }} />
                          </td>
                          <td style={{ ...fdStyles.td, ...fdStyles.tdNum }} onClick={(e) => e.stopPropagation()}>
                            $<window.EditField value={d.unit_usd} type="number" onCommit={(v) => { d.unit_usd = parseFloat(v)||0; }} />
                          </td>
                          <td style={{ ...fdStyles.td, ...fdStyles.tdNum, fontWeight:600 }} onClick={(e) => e.stopPropagation()}>
                            ¥<window.EditField value={d.total_jpy} type="number" onCommit={(v) => { d.total_jpy = parseInt(v)||0; }} fontWeight={600} />
                          </td>
                          <td style={{ ...fdStyles.td, ...fdStyles.tdNum }}>
                            <span style={{ ...fdStyles.pillProfit, background: d.profit_pct >= 40 ? '#e7f0e6' : d.profit_pct >= 30 ? '#f5f0dc' : '#fdebe1' }}>
                              {d.profit_pct.toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ ...fdStyles.td, ...fdStyles.tdCenter }}>
                            <span style={fdStyles.pillStatus}>
                              <span style={{ width:6, height:6, borderRadius:'50%', background:stat.dot }}></span>
                              {stat.short}
                            </span>
                          </td>
                          <td style={{ ...fdStyles.td, ...fdStyles.tdCenter, color: urgent ? '#c0392b' : '#0a0a0a', fontFamily:"'Fraunces', serif", fontWeight: urgent ? 600 : 500, fontSize:10.5 }} onClick={(e) => e.stopPropagation()}>
                            <window.EditField value={d.delivery} type="date" onCommit={(v) => { d.delivery = v; }} />
                          </td>
                          <td style={{ ...fdStyles.td, ...fdStyles.tdMuted, fontSize:10.5 }} onClick={(e) => e.stopPropagation()}>
                            <window.EditField value={d.factory} type="select" options={['—', ...window.FACTORIES]} onCommit={(v) => { d.factory = v; }} />
                          </td>
                          <td style={{ ...fdStyles.td, ...fdStyles.tdMuted, fontSize:10.5 }} onClick={(e) => e.stopPropagation()}>
                            <window.EditField value={d.sales} type="select" options={window.SALES} onCommit={(v) => { d.sales = v; }} />
                          </td>
                          <td style={{ ...fdStyles.td, ...fdStyles.tdMuted, fontSize:10, fontFamily:"'Fraunces', serif" }}>{window.fmtDate(d.updated)}</td>
                        </tr>

                        {dealOpen && variants.map((v, vi) => {
                          const isAdopt = adoptIdx === vi;
                          return (
                            <tr key={d.id + 'v' + vi} style={fdStyles.variantHead}>
                              <td style={fdStyles.variantTd}></td>
                              <td colSpan={2} style={{ ...fdStyles.variantTd, paddingLeft:48 }}>
                                <span style={fdStyles.variantNote}>└</span>
                                <span style={fdStyles.variantNote}>{v.note}</span>
                                <button onClick={(e) => { e.stopPropagation(); setAdopted({ ...adopted, [d.id]:vi }); }}
                                        style={{ ...fdStyles.variantAdoptBtn, ...(isAdopt ? fdStyles.variantAdoptBtnActive : {}) }}>
                                  {isAdopt ? '採用中 ✓' : '採用'}
                                </button>
                              </td>
                              <td style={{ ...fdStyles.variantTd, ...fdStyles.tdNum }} onClick={(e) => e.stopPropagation()}>
                                <window.EditField value={v.qty} type="number" onCommit={(val) => { v.qty = parseInt(val)||0; }} />
                              </td>
                              <td style={{ ...fdStyles.variantTd, ...fdStyles.tdNum }} onClick={(e) => e.stopPropagation()}>
                                $<window.EditField value={v.unit_usd} type="number" onCommit={(val) => { v.unit_usd = parseFloat(val)||0; }} />
                              </td>
                              <td style={{ ...fdStyles.variantTd, ...fdStyles.tdNum, fontWeight:600 }} onClick={(e) => e.stopPropagation()}>
                                ¥<window.EditField value={v.total_jpy} type="number" onCommit={(val) => { v.total_jpy = parseInt(val)||0; }} fontWeight={600} />
                              </td>
                              <td style={{ ...fdStyles.variantTd, ...fdStyles.tdNum }} onClick={(e) => e.stopPropagation()}>
                                <window.EditField value={v.profit_pct} type="number" onCommit={(val) => { v.profit_pct = parseFloat(val)||0; }} suffix="%" />
                              </td>
                              <td colSpan={5} style={{ ...fdStyles.variantTd, ...fdStyles.tdMuted, fontSize:10 }}>v{v.version}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.FinalDealsView = FinalDealsView;
window.fdStyles = fdStyles;
