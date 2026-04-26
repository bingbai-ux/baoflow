// Variation 2: Hybrid - Compact List on left, Detail panel on right
// Click row to view/edit details. Keyboard nav (j/k or arrows).

const v2Styles = {
  wrap: {
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
    color:'#0a0a0a',
    background:'#fff',
    border:'1px solid rgba(0,0,0,0.06)',
    borderRadius:14,
    overflow:'hidden',
    display:'flex',
    flexDirection:'column',
    height:780,
  },
  toolbar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'10px 14px', borderBottom:'1px solid rgba(0,0,0,0.06)',
  },
  body: { display:'flex', flex:1, overflow:'hidden' },
  list: {
    flex:'0 0 56%', overflow:'auto',
    borderRight:'1px solid rgba(0,0,0,0.06)',
  },
  panel: {
    flex:1, overflow:'auto', background:'#fafaf9',
  },
  groupHd: {
    position:'sticky', top:0, zIndex:2,
    background:'#fafaf9',
    padding:'8px 14px',
    fontSize:10, color:'#888',
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
    fontWeight:500,
    letterSpacing:'0.04em',
    borderBottom:'1px solid rgba(0,0,0,0.06)',
    display:'flex', alignItems:'baseline', justifyContent:'space-between',
  },
  row: (selected, alert) => ({
    display:'grid',
    gridTemplateColumns:'14px 1fr 80px 90px 80px',
    gap:10, alignItems:'center',
    padding:'7px 14px',
    height:32,
    fontSize:11,
    cursor:'pointer',
    background: selected ? 'rgba(34,197,94,0.06)' : alert ? '#fffaf2' : '#fff',
    borderLeft: selected ? '2px solid #22c55e' : '2px solid transparent',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
  }),
  num: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    textAlign:'right', fontSize:11,
  },
  // panel
  pHd: {
    padding:'18px 22px 14px',
    borderBottom:'1px solid rgba(0,0,0,0.06)',
    background:'#fff',
  },
  pTitle: {
    fontFamily:"'Fraunces', serif", fontWeight:600,
    fontSize:18, color:'#0a0a0a', lineHeight:1.3,
    marginTop:4,
  },
  pSec: { padding:'14px 22px', borderBottom:'1px solid rgba(0,0,0,0.06)' },
  pSecTitle: {
    fontSize:10, color:'#888',
    textTransform:'uppercase', letterSpacing:'0.06em',
    marginBottom:8, fontWeight:500,
  },
  fieldGrid: { display:'grid', gridTemplateColumns:'90px 1fr', rowGap:8, columnGap:12, fontSize:12 },
  fieldLabel: { color:'#888' },
  fieldVal: { color:'#0a0a0a' },
  fieldNum: { fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' },
  input: {
    border:'1px solid #e8e8e6', borderRadius:6, padding:'4px 8px',
    fontSize:12, fontFamily:'inherit', background:'#fff',
    width:'100%', outline:'none',
  },
  inputBorderless: {
    border:'1px solid transparent', borderRadius:6, padding:'4px 8px',
    fontSize:12, fontFamily:'inherit', background:'transparent',
    width:'100%', outline:'none',
  },
  bigStat: {
    fontFamily:"'Fraunces', serif",
    fontVariantNumeric:'tabular-nums',
    fontSize:24, fontWeight:600, color:'#0a0a0a', lineHeight:1,
  },
  statGrid: {
    display:'grid', gridTemplateColumns:'repeat(3, 1fr)',
    gap:8, padding:'14px 22px', background:'#fff',
    borderBottom:'1px solid rgba(0,0,0,0.06)',
  },
  statBox: { padding:'10px 12px', background:'#fafaf9', borderRadius:8 },
  statLabel: { fontSize:10, color:'#888', marginBottom:4 },
  emptyPanel: {
    display:'flex', alignItems:'center', justifyContent:'center',
    height:'100%', color:'#bbb', fontSize:12,
  },
};

function V2Hybrid() {
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [selectedId, setSelectedId] = React.useState(window.DEALS[0].id);

  const filtered = window.DEALS
    .filter(d => {
      if (filter === 'active' && d.status === 'delivered') return false;
      if (filter === 'urgent' && !window.isUrgent(d)) return false;
      if (filter === 'stale' && !window.isStale(d)) return false;
      if (search) {
        const q = search.toLowerCase();
        return d.name.toLowerCase().includes(q) ||
               d.id.toLowerCase().includes(q) ||
               window.clientById(d.client).name.toLowerCase().includes(q);
      }
      return true;
    });

  // Group by client
  const groups = React.useMemo(() => {
    const m = new Map();
    for (const d of filtered) {
      if (!m.has(d.client)) m.set(d.client, []);
      m.get(d.client).push(d);
    }
    for (const arr of m.values()) {
      arr.sort((a,b) => window.STATUS_ORDER.indexOf(a.status) - window.STATUS_ORDER.indexOf(b.status));
    }
    return Array.from(m.entries()).map(([cid, deals]) => ({
      cid, name: window.clientById(cid).name, deals,
      total: deals.reduce((s,d) => s + d.total_jpy, 0)
    }));
  }, [filtered]);

  const selected = window.DEALS.find(d => d.id === selectedId);

  // Keyboard navigation
  const allIds = filtered.map(d => d.id);
  const onKey = (e) => {
    const idx = allIds.indexOf(selectedId);
    if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); if (idx < allIds.length-1) setSelectedId(allIds[idx+1]); }
    if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); if (idx > 0) setSelectedId(allIds[idx-1]); }
  };

  return (
    <div style={v2Styles.wrap} tabIndex={0} onKeyDown={onKey}>
      <div style={v2Styles.toolbar}>
        <div style={{ display:'flex', gap:2 }}>
          {[['all','すべて'],['active','進行中'],['urgent','納期'],['stale','停滞']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{
                padding:'5px 12px', borderRadius:9999,
                background: filter===k ? '#0a0a0a' : 'transparent',
                color: filter===k ? '#fff' : '#888',
                fontSize:12, border:'none', cursor:'pointer',
                fontFamily: filter===k ? "'Fraunces', serif" : 'inherit',
                fontWeight: filter===k ? 600 : 400,
              }}>{l}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f5f5f4', borderRadius:8, padding:'5px 10px', flex:1, maxWidth:280, marginLeft:12 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input style={{ border:'none', outline:'none', background:'transparent', fontSize:12, fontFamily:'inherit', flex:1 }}
            placeholder="案件名・クライアントで検索" value={search} onChange={e => setSearch(e.target.value)} />
          <span style={{ fontSize:9, color:'#bbb', fontFamily:"'Fraunces', serif" }}>↑↓ で移動</span>
        </div>
        <button style={{ background:'#0a0a0a', color:'#fff', borderRadius:8, padding:'5px 12px', fontSize:12, border:'none', cursor:'pointer', marginLeft:12, fontWeight:500 }}>
          + 新規案件
        </button>
      </div>

      <div style={v2Styles.body}>
        <div style={v2Styles.list}>
          {/* List header */}
          <div style={{ display:'grid', gridTemplateColumns:'14px 1fr 80px 90px 80px', gap:10, padding:'8px 14px', fontSize:9, color:'#bbb', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid rgba(0,0,0,0.06)', background:'#fff' }}>
            <span></span>
            <span>案件名</span>
            <span style={{ textAlign:'right' }}>数量</span>
            <span style={{ textAlign:'right' }}>請求合計</span>
            <span style={{ textAlign:'right' }}>納期</span>
          </div>

          {groups.map(g => (
            <React.Fragment key={g.cid}>
              <div style={v2Styles.groupHd}>
                <span><span style={{ color:'#0a0a0a', fontWeight:600, fontSize:11, fontFamily:"'Zen Kaku Gothic New', sans-serif" }}>{g.name}</span> <span style={{ marginLeft:6, color:'#bbb' }}>{g.deals.length}</span></span>
                <span style={{ color:'#0a0a0a', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:11, fontWeight:600 }}>{window.fmtJPY(g.total)}</span>
              </div>
              {g.deals.map(d => {
                const stale = window.isStale(d);
                const urgent = window.isUrgent(d);
                const dUntil = window.daysUntil(d.delivery);
                return (
                  <div key={d.id}
                    style={v2Styles.row(d.id === selectedId, stale || urgent)}
                    onClick={() => setSelectedId(d.id)}>
                    <window.StatusDot status={d.status} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, lineHeight:1.2 }}>
                        <span style={{ fontFamily:"'Fraunces', serif", color:'#888', fontVariantNumeric:'tabular-nums', fontSize:9.5 }}>{d.id}</span>
                        <span style={{ fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                        {urgent && <span style={{ fontSize:8.5, color:'#e5a32e' }}>●</span>}
                      </div>
                    </div>
                    <span style={v2Styles.num}>{d.qty.toLocaleString()}</span>
                    <span style={{ ...v2Styles.num, fontWeight:500 }}>{window.fmtJPY(d.total_jpy)}</span>
                    <span style={{ ...v2Styles.num, color: dUntil < 14 ? '#e5a32e' : '#888' }}>{window.fmtDate(d.delivery)}</span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <div style={v2Styles.panel}>
          {selected ? <V2Detail deal={selected} /> : <div style={v2Styles.emptyPanel}>案件を選択してください</div>}
        </div>
      </div>
    </div>
  );
}

function V2Detail({ deal }) {
  const [d, setD] = React.useState(deal);
  React.useEffect(() => setD(deal), [deal]);

  // Auto-calculated total in JPY
  const fxRate = 155;
  const totalUsd = (d.qty * d.unit_usd);
  const totalJpyAuto = Math.round(totalUsd * fxRate / (1 - d.profit_pct/100));

  const update = (k, v) => setD({ ...d, [k]: v });

  return (
    <div>
      <div style={v2Styles.pHd}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:10, color:'#888', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>
          <span>{d.id}</span>
          <span style={{ color:'#bbb' }}>·</span>
          <span style={{ color:'#0a0a0a', fontFamily:"'Zen Kaku Gothic New', sans-serif" }}>{window.clientById(d.client).name}</span>
          <span style={{ color:'#bbb' }}>·</span>
          <span>{d.version}</span>
        </div>
        <input
          style={{ ...v2Styles.inputBorderless, ...v2Styles.pTitle, width:'100%', padding:'2px 0' }}
          value={d.name}
          onChange={e => update('name', e.target.value)}
        />
        <div style={{ marginTop:10 }}>
          <window.MiniProgress status={d.status} />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:10, color:'#888' }}>
            <span><window.StatusPill status={d.status} /></span>
            <span>Step {window.STATUS[d.status].step}/7</span>
          </div>
        </div>
      </div>

      <div style={v2Styles.statGrid}>
        <div style={v2Styles.statBox}>
          <div style={v2Styles.statLabel}>請求合計（自動計算）</div>
          <div style={v2Styles.bigStat}>{window.fmtJPY(d.total_jpy)}</div>
          <div style={{ fontSize:9, color:'#bbb', marginTop:3, fontFamily:"'Fraunces', serif" }}>USD {window.fmtUSD(totalUsd)}</div>
        </div>
        <div style={v2Styles.statBox}>
          <div style={v2Styles.statLabel}>粗利率</div>
          <div style={{ ...v2Styles.bigStat, color: d.profit_pct >= 35 ? '#15803d' : d.profit_pct >= 25 ? '#0a0a0a' : '#e5a32e' }}>{d.profit_pct.toFixed(1)}<span style={{ fontSize:14, opacity:.6 }}>%</span></div>
          <div style={{ fontSize:9, color:'#bbb', marginTop:3 }}>原価率 {(100-d.profit_pct).toFixed(1)}%</div>
        </div>
        <div style={v2Styles.statBox}>
          <div style={v2Styles.statLabel}>納期まで</div>
          <div style={{ ...v2Styles.bigStat, color: window.daysUntil(d.delivery) < 14 ? '#e5a32e' : '#0a0a0a' }}>{window.daysUntil(d.delivery)}<span style={{ fontSize:14, opacity:.6 }}>日</span></div>
          <div style={{ fontSize:9, color:'#bbb', marginTop:3, fontFamily:"'Fraunces', serif" }}>{window.fmtDateLong(d.delivery)}</div>
        </div>
      </div>

      <div style={v2Styles.pSec}>
        <div style={v2Styles.pSecTitle}>商品仕様</div>
        <div style={v2Styles.fieldGrid}>
          <span style={v2Styles.fieldLabel}>仕様</span>
          <input style={v2Styles.input} value={d.spec} onChange={e => update('spec', e.target.value)} />
          <span style={v2Styles.fieldLabel}>数量</span>
          <input style={{ ...v2Styles.input, ...v2Styles.fieldNum }} type="number" value={d.qty} onChange={e => update('qty', +e.target.value)} />
          <span style={v2Styles.fieldLabel}>単価USD</span>
          <input style={{ ...v2Styles.input, ...v2Styles.fieldNum }} type="number" step="0.001" value={d.unit_usd} onChange={e => update('unit_usd', +e.target.value)} />
          <span style={v2Styles.fieldLabel}>原価USD</span>
          <span style={{ ...v2Styles.fieldVal, ...v2Styles.fieldNum, padding:'4px 8px', color:'#888' }}>
            {window.fmtUSD(totalUsd)} <span style={{ fontSize:9, color:'#bbb', marginLeft:6 }}>自動計算</span>
          </span>
          <span style={v2Styles.fieldLabel}>請求合計JPY</span>
          <span style={{ ...v2Styles.fieldVal, ...v2Styles.fieldNum, padding:'4px 8px', color:'#0a0a0a', fontWeight:600 }}>
            {window.fmtJPY(d.total_jpy)} <span style={{ fontSize:9, color:'#bbb', marginLeft:6, fontWeight:400, fontFamily:"'Zen Kaku Gothic New', sans-serif" }}>FX {fxRate}, 掛け率0.55</span>
          </span>
        </div>
      </div>

      <div style={v2Styles.pSec}>
        <div style={v2Styles.pSecTitle}>担当・工場</div>
        <div style={v2Styles.fieldGrid}>
          <span style={v2Styles.fieldLabel}>担当営業</span>
          <input style={v2Styles.input} value={d.sales} onChange={e => update('sales', e.target.value)} />
          <span style={v2Styles.fieldLabel}>工場</span>
          <input style={v2Styles.input} value={d.factory} onChange={e => update('factory', e.target.value)} />
          <span style={v2Styles.fieldLabel}>希望納期</span>
          <input style={{ ...v2Styles.input, ...v2Styles.fieldNum }} type="date" value={d.delivery} onChange={e => update('delivery', e.target.value)} />
          <span style={v2Styles.fieldLabel}>見積Ver</span>
          <input style={{ ...v2Styles.input, ...v2Styles.fieldNum }} value={d.version} onChange={e => update('version', e.target.value)} />
        </div>
      </div>

      <div style={v2Styles.pSec}>
        <div style={v2Styles.pSecTitle}>メモ</div>
        <textarea
          style={{ ...v2Styles.input, minHeight:60, resize:'vertical', fontFamily:'inherit' }}
          value={d.memo}
          onChange={e => update('memo', e.target.value)}
          placeholder="メモを追加..."
        />
      </div>

      <div style={{ ...v2Styles.pSec, display:'flex', gap:8, borderBottom:'none' }}>
        <button style={{ background:'#0a0a0a', color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer', fontWeight:500 }}>次のステータスへ</button>
        <button style={{ background:'#fff', color:'#555', border:'1px solid #e8e8e6', borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer' }}>見積書PDF</button>
        <button style={{ background:'#fff', color:'#555', border:'1px solid #e8e8e6', borderRadius:8, padding:'7px 14px', fontSize:12, cursor:'pointer' }}>複製</button>
      </div>
    </div>
  );
}

window.V2Hybrid = V2Hybrid;
