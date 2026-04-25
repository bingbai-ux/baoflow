// Variation 3: Kanban by Status (7 columns)
// Compact card-based view, scrolls horizontally on narrow viewports

const v3Styles = {
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
  board: {
    display:'grid', gridTemplateColumns:'repeat(7, minmax(180px, 1fr))',
    gap:8, padding:12, background:'#fafaf9',
    overflow:'auto', minHeight:680,
  },
  col: {
    background:'#fff', borderRadius:10,
    border:'1px solid rgba(0,0,0,0.06)',
    display:'flex', flexDirection:'column', minWidth:0,
  },
  colHd: {
    padding:'10px 12px',
    borderBottom:'1px solid rgba(0,0,0,0.06)',
    display:'flex', alignItems:'center', gap:6,
  },
  colTotal: {
    padding:'6px 12px',
    fontSize:10, color:'#888',
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    background:'#fafaf9',
  },
  colBody: {
    padding:6, display:'flex', flexDirection:'column', gap:4, overflow:'auto', flex:1,
  },
  card: (alert) => ({
    padding:'8px 10px',
    background: alert ? '#fffaf2' : '#fff',
    border:'1px solid rgba(0,0,0,0.06)',
    borderRadius:7,
    cursor:'grab',
    fontSize:11, lineHeight:1.4,
  }),
  addCol: {
    padding:'7px 10px', fontSize:10, color:'#bbb',
    textAlign:'center', cursor:'pointer',
    borderTop:'1px dashed rgba(0,0,0,0.06)',
  },
};

function V3Kanban() {
  const [groupBy, setGroupBy] = React.useState('client'); // client | none

  const byStatus = window.STATUS_ORDER.reduce((acc, s) => { acc[s] = []; return acc; }, {});
  for (const d of window.DEALS) byStatus[d.status].push(d);
  // Sort each: by client then by delivery
  for (const s of window.STATUS_ORDER) {
    byStatus[s].sort((a,b) => {
      if (groupBy === 'client') {
        const ca = window.clientById(a.client).name;
        const cb = window.clientById(b.client).name;
        if (ca !== cb) return ca.localeCompare(cb);
      }
      return new Date(a.delivery) - new Date(b.delivery);
    });
  }

  return (
    <div style={v3Styles.wrap}>
      <div style={v3Styles.toolbar}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <span style={{ fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:13 }}>進捗ボード</span>
          <span style={{ fontSize:11, color:'#888' }}>合計 <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', color:'#0a0a0a' }}>{window.DEALS.length}</span> 件</span>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:10, color:'#888' }}>並び順</span>
          {[['client','クライアント別'],['none','納期順']].map(([k,l]) => (
            <button key={k} onClick={() => setGroupBy(k)}
              style={{
                padding:'4px 10px', borderRadius:9999, fontSize:11, border:'none', cursor:'pointer',
                background: groupBy===k ? '#0a0a0a' : 'transparent',
                color: groupBy===k ? '#fff' : '#888',
                fontFamily: groupBy===k ? "'Fraunces', serif" : 'inherit',
                fontWeight: groupBy===k ? 600 : 400,
              }}>{l}</button>
          ))}
          <button style={{ background:'#0a0a0a', color:'#fff', borderRadius:8, padding:'5px 12px', fontSize:12, border:'none', cursor:'pointer', marginLeft:8, fontWeight:500 }}>
            + 新規案件
          </button>
        </div>
      </div>

      <div style={v3Styles.board}>
        {window.STATUS_ORDER.map(s => {
          const cfg = window.STATUS[s];
          const deals = byStatus[s];
          const total = deals.reduce((sum,d) => sum + d.total_jpy, 0);
          let lastClient = null;
          return (
            <div key={s} style={v3Styles.col}>
              <div style={v3Styles.colHd}>
                <window.StatusDot status={s} />
                <span style={{ fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:11 }}>{cfg.label}</span>
                <span style={{ marginLeft:'auto', fontSize:10, color:'#888', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{deals.length}</span>
              </div>
              <div style={v3Styles.colTotal}>{window.fmtJPY(total)}</div>
              <div style={v3Styles.colBody}>
                {deals.map(d => {
                  const stale = window.isStale(d);
                  const urgent = window.isUrgent(d);
                  const showClient = groupBy === 'client' && window.clientById(d.client).name !== lastClient;
                  lastClient = window.clientById(d.client).name;
                  return (
                    <React.Fragment key={d.id}>
                      {showClient && (
                        <div style={{ fontSize:9, color:'#bbb', textTransform:'uppercase', letterSpacing:'0.04em', padding:'4px 4px 1px', fontFamily:"'Zen Kaku Gothic New', sans-serif" }}>
                          {window.clientById(d.client).name}
                        </div>
                      )}
                      <div style={v3Styles.card(stale || urgent)}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                          <span style={{ fontFamily:"'Fraunces', serif", color:'#888', fontVariantNumeric:'tabular-nums', fontSize:9 }}>{d.id}</span>
                          {urgent && <span style={{ fontSize:8.5, color:'#e5a32e' }}>● 納期</span>}
                          {stale && !urgent && <span style={{ fontSize:8.5, color:'#888' }}>● 停滞</span>}
                          <span style={{ marginLeft:'auto', fontSize:9, color:'#888', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{d.version}</span>
                        </div>
                        <div style={{ fontWeight:500, fontSize:11.5, marginBottom:4, lineHeight:1.3 }}>{d.name}</div>
                        <div style={{ fontSize:10, color:'#888', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.spec}</div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize:10 }}>
                          <span style={{ color:'#888' }}>{d.qty.toLocaleString()} 個</span>
                          <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontWeight:600, color:'#0a0a0a', fontSize:11 }}>{window.fmtJPY(d.total_jpy)}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:9.5, color:'#888', marginTop:5, paddingTop:5, borderTop:'1px solid rgba(0,0,0,0.05)' }}>
                          <span>{d.sales}</span>
                          <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', color: window.daysUntil(d.delivery) < 14 ? '#e5a32e' : '#888' }}>納期 {window.fmtDate(d.delivery)}</span>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <div style={v3Styles.addCol}>+ 追加</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.V3Kanban = V3Kanban;
