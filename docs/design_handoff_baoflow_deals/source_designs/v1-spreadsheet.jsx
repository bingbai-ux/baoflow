// Variation 1: Excel-faithful Spreadsheet
// Frozen header + frozen left columns, inline cells, very compact (28px rows)

const v1Styles = {
  wrap: {
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
    color:'#0a0a0a',
    background:'#fff',
    border:'1px solid rgba(0,0,0,0.06)',
    borderRadius:14,
    overflow:'hidden',
    display:'flex',
    flexDirection:'column',
  },
  toolbar: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'10px 14px', borderBottom:'1px solid rgba(0,0,0,0.06)',
    gap:12,
  },
  tabs: { display:'flex', gap:2 },
  tab: (active) => ({
    padding:'5px 12px', borderRadius:9999,
    background: active ? '#0a0a0a' : 'transparent',
    color: active ? '#fff' : '#888',
    fontFamily: active ? "'Fraunces', serif" : "'Zen Kaku Gothic New', sans-serif",
    fontWeight: active ? 600 : 400,
    fontSize:12, cursor:'pointer', border:'none',
    fontVariantNumeric:'tabular-nums',
  }),
  search: {
    display:'flex', alignItems:'center', gap:6, background:'#f5f5f4',
    borderRadius:8, padding:'5px 10px', flex:1, maxWidth:320,
    border:'1px solid transparent',
  },
  searchInput: {
    border:'none', outline:'none', background:'transparent',
    fontSize:12, fontFamily:'inherit', flex:1,
  },
  addBtn: {
    background:'#0a0a0a', color:'#fff', borderRadius:8,
    padding:'5px 12px', fontSize:12, fontFamily:"'Zen Kaku Gothic New', sans-serif",
    fontWeight:500, border:'none', cursor:'pointer', whiteSpace:'nowrap',
  },
  scroll: { overflow:'auto', flex:1, maxHeight:760 },
  table: {
    borderCollapse:'separate', borderSpacing:0,
    width:'100%', fontSize:11,
    fontVariantNumeric:'tabular-nums',
  },
  th: {
    position:'sticky', top:0, zIndex:3,
    background:'#fafaf9',
    padding:'8px 10px', textAlign:'left',
    fontWeight:500, color:'#888', fontSize:10,
    borderBottom:'1px solid rgba(0,0,0,0.08)',
    whiteSpace:'nowrap',
    letterSpacing:'0.02em',
    textTransform:'uppercase',
  },
  thNum: { textAlign:'right' },
  td: {
    padding:'7px 10px',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    borderRight:'1px solid rgba(0,0,0,0.03)',
    background:'#fff',
    height:30, lineHeight:'16px',
    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
    maxWidth:240,
    verticalAlign:'middle',
  },
  tdNum: { textAlign:'right', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' },
  tdId: { fontFamily:"'Fraunces', serif", color:'#888', fontVariantNumeric:'tabular-nums', fontSize:10 },
  rowAlert: { background:'#fffaf2' },
  rowGroup: {
    background:'#f5f5f4',
    fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:11,
    color:'#0a0a0a',
  },
  // frozen left columns
  freezeId:    { position:'sticky', left:0,    zIndex:2, minWidth:90  },
  freezeName:  { position:'sticky', left:90,   zIndex:2, minWidth:240, borderRight:'1px solid rgba(0,0,0,0.08)' },
  freezeIdHd:  { position:'sticky', left:0,    zIndex:4, minWidth:90  },
  freezeNameHd:{ position:'sticky', left:90,   zIndex:4, minWidth:240, borderRight:'1px solid rgba(0,0,0,0.08)' },
  inputCell: {
    border:'none', outline:'none', background:'transparent',
    width:'100%', fontFamily:'inherit', fontSize:'inherit',
    color:'inherit', padding:0, fontVariantNumeric:'tabular-nums',
  },
  inputNum: { textAlign:'right', fontFamily:"'Fraunces', serif" },
  alertBadge: {
    display:'inline-flex', alignItems:'center', gap:3,
    fontSize:9, color:'#e5a32e',
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
  },
  newRow: {
    background:'#fafaf9',
    color:'#888', fontStyle:'italic',
    cursor:'pointer',
  },
  footer: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'8px 14px', borderTop:'1px solid rgba(0,0,0,0.06)',
    fontSize:11, color:'#888', background:'#fafaf9',
  },
};

function V1Spreadsheet() {
  const [filter, setFilter] = React.useState('all'); // all | active | stale | urgent
  const [search, setSearch] = React.useState('');
  const [groupByClient, setGroupByClient] = React.useState(true);
  const [editingCell, setEditingCell] = React.useState(null); // [rowId, col]

  const filtered = React.useMemo(() => {
    let r = window.DEALS;
    if (filter === 'active') r = r.filter(d => d.status !== 'delivered');
    if (filter === 'stale') r = r.filter(window.isStale);
    if (filter === 'urgent') r = r.filter(window.isUrgent);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        window.clientById(d.client).name.toLowerCase().includes(q)
      );
    }
    return r;
  }, [filter, search]);

  // Group by client
  const grouped = React.useMemo(() => {
    if (!groupByClient) return [{ key:'all', label:null, deals: filtered }];
    const map = new Map();
    for (const d of filtered) {
      if (!map.has(d.client)) map.set(d.client, []);
      map.get(d.client).push(d);
    }
    // sort each group by status order then by delivery
    for (const arr of map.values()) {
      arr.sort((a,b) => {
        const sa = window.STATUS_ORDER.indexOf(a.status);
        const sb = window.STATUS_ORDER.indexOf(b.status);
        if (sa !== sb) return sa - sb;
        return new Date(a.delivery) - new Date(b.delivery);
      });
    }
    return Array.from(map.entries()).map(([key, deals]) => ({
      key, label: window.clientById(key).name, deals,
      total: deals.reduce((s,d) => s + d.total_jpy, 0),
    }));
  }, [filtered, groupByClient]);

  const totalCount = filtered.length;
  const totalRevenue = filtered.reduce((s,d) => s + d.total_jpy, 0);

  const cols = [
    { k:'id',       label:'ID',         w:90,  freeze:'id' },
    { k:'name',     label:'案件名',     w:240, freeze:'name' },
    { k:'spec',     label:'仕様',       w:220 },
    { k:'qty',      label:'数量',       w:80,  num:true },
    { k:'unit_usd', label:'単価USD',    w:80,  num:true },
    { k:'total_jpy',label:'請求合計',   w:110, num:true },
    { k:'profit',   label:'粗利',       w:60,  num:true },
    { k:'status',   label:'ステータス', w:150 },
    { k:'delivery', label:'希望納期',   w:90 },
    { k:'factory',  label:'工場',       w:130 },
    { k:'sales',    label:'担当',       w:60 },
    { k:'version',  label:'Ver',        w:50 },
    { k:'updated',  label:'更新',       w:80 },
    { k:'memo',     label:'メモ',       w:200 },
  ];

  return (
    <div style={v1Styles.wrap}>
      <div style={v1Styles.toolbar}>
        <div style={v1Styles.tabs}>
          {[
            ['all','すべて',totalCount],
            ['active','進行中', window.DEALS.filter(d => d.status !== 'delivered').length],
            ['urgent','納期 ≤14日', window.DEALS.filter(window.isUrgent).length],
            ['stale','停滞', window.DEALS.filter(window.isStale).length],
          ].map(([k,l,c]) => (
            <button key={k} style={v1Styles.tab(filter===k)} onClick={() => setFilter(k)}>
              {l} <span style={{ opacity:.6, marginLeft:4 }}>{c}</span>
            </button>
          ))}
        </div>
        <div style={v1Styles.search}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input
            style={v1Styles.searchInput}
            placeholder="案件名・クライアント・IDで検索"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#555', cursor:'pointer' }}>
          <input type="checkbox" checked={groupByClient} onChange={e => setGroupByClient(e.target.checked)} />
          クライアント別
        </label>
        <button style={v1Styles.addBtn}>+ 新規案件</button>
      </div>

      <div style={v1Styles.scroll}>
        <table style={v1Styles.table}>
          <thead>
            <tr>
              {cols.map(c => {
                let s = { ...v1Styles.th, width: c.w, minWidth: c.w };
                if (c.num) s = { ...s, ...v1Styles.thNum };
                if (c.freeze === 'id') s = { ...s, ...v1Styles.freezeIdHd };
                if (c.freeze === 'name') s = { ...s, ...v1Styles.freezeNameHd };
                return <th key={c.k} style={s}>{c.label}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {grouped.map(group => (
              <React.Fragment key={group.key}>
                {group.label && (
                  <tr>
                    <td colSpan={cols.length} style={{ ...v1Styles.td, ...v1Styles.rowGroup, padding:'6px 12px', position:'sticky', left:0 }}>
                      <span style={{ display:'inline-flex', alignItems:'baseline', gap:10 }}>
                        <span style={{ fontSize:11, color:'#0a0a0a' }}>{group.label}</span>
                        <span style={{ fontSize:10, color:'#888', fontWeight:400, fontFamily:"'Zen Kaku Gothic New', sans-serif" }}>
                          {group.deals.length}件
                        </span>
                        <span style={{ fontSize:11, color:'#0a0a0a', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>
                          {window.fmtJPY(group.total)}
                        </span>
                      </span>
                    </td>
                  </tr>
                )}
                {group.deals.map(d => {
                  const stale = window.isStale(d);
                  const urgent = window.isUrgent(d);
                  const rowBg = stale || urgent ? v1Styles.rowAlert.background : '#fff';
                  const dUntil = window.daysUntil(d.delivery);
                  return (
                    <tr key={d.id}>
                      {cols.map(c => {
                        let style = { ...v1Styles.td, background: rowBg, width: c.w, minWidth: c.w };
                        if (c.num) style = { ...style, ...v1Styles.tdNum };
                        if (c.freeze === 'id') style = { ...style, ...v1Styles.freezeId };
                        if (c.freeze === 'name') style = { ...style, ...v1Styles.freezeName };

                        let content = null;
                        if (c.k === 'id') content = <span style={v1Styles.tdId}>{d.id}</span>;
                        else if (c.k === 'name') content = (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontWeight:500, color:'#0a0a0a', overflow:'hidden', textOverflow:'ellipsis' }}>{d.name}</span>
                            {urgent && <span style={v1Styles.alertBadge}>● 納期</span>}
                            {stale && !urgent && <span style={{ ...v1Styles.alertBadge, color:'#888' }}>● 停滞</span>}
                          </span>
                        );
                        else if (c.k === 'spec') content = <span style={{ color:'#555' }}>{d.spec}</span>;
                        else if (c.k === 'qty') content = <EditCell value={d.qty.toLocaleString()} num />;
                        else if (c.k === 'unit_usd') content = <EditCell value={window.fmtUSDsmall(d.unit_usd)} num />;
                        else if (c.k === 'total_jpy') content = <span style={{ fontWeight:500, color:'#0a0a0a' }}><window.MoneyHover jpy={d.total_jpy} usd={d.unit_usd} qty={d.qty} /></span>;
                        else if (c.k === 'profit') content = <span style={{ color: d.profit_pct >= 35 ? '#15803d' : d.profit_pct >= 25 ? '#0a0a0a' : '#e5a32e' }}>{d.profit_pct.toFixed(1)}%</span>;
                        else if (c.k === 'status') content = <window.StatusPill status={d.status} />;
                        else if (c.k === 'delivery') content = (
                          <span style={{ display:'inline-flex', alignItems:'baseline', gap:4 }}>
                            <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{window.fmtDate(d.delivery)}</span>
                            <span style={{ fontSize:9, color: dUntil < 14 ? '#e5a32e' : '#bbb', fontFamily:"'Fraunces', serif" }}>
                              {dUntil > 0 ? `+${dUntil}d` : `${dUntil}d`}
                            </span>
                          </span>
                        );
                        else if (c.k === 'factory') content = <span style={{ color:'#555' }}>{d.factory}</span>;
                        else if (c.k === 'sales') content = <span style={{ color:'#555' }}>{d.sales}</span>;
                        else if (c.k === 'version') content = <span style={{ color:'#888', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{d.version}</span>;
                        else if (c.k === 'updated') content = <span style={{ color:'#888', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{window.fmtDate(d.updated)}</span>;
                        else if (c.k === 'memo') content = <span style={{ color:'#888', fontStyle: d.memo ? 'normal':'italic' }}>{d.memo || '—'}</span>;

                        return <td key={c.k} style={style} title={c.k === 'memo' ? d.memo : undefined}>{content}</td>;
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {/* New row */}
            <tr>
              <td colSpan={cols.length} style={{ ...v1Styles.td, ...v1Styles.newRow, height:30, position:'sticky', left:0 }}>
                + 行を追加して新規案件を作成 <span style={{ fontSize:10, opacity:.6, marginLeft:8 }}>Tab で次のセル / Enter で確定</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={v1Styles.footer}>
        <span>{totalCount} 件表示中</span>
        <span style={{ display:'flex', gap:18 }}>
          <span>合計請求 <span style={{ color:'#0a0a0a', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontWeight:600 }}>{window.fmtJPY(totalRevenue)}</span></span>
          <span>進行中 <span style={{ color:'#0a0a0a', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontWeight:600 }}>{window.DEALS.filter(d => d.status !== 'delivered').length}</span></span>
        </span>
      </div>
    </div>
  );
}

function EditCell({ value, num }) {
  const [v, setV] = React.useState(value);
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => setV(value), [value]);
  const cellStyle = num
    ? { ...v1Styles.inputCell, ...v1Styles.inputNum }
    : v1Styles.inputCell;
  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{ cursor:'text', display:'block', minHeight:14, fontFamily: num ? "'Fraunces', serif" : 'inherit' }}
      >
        {v}
      </span>
    );
  }
  return (
    <input
      autoFocus
      style={cellStyle}
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); }}
    />
  );
}

window.V1Spreadsheet = V1Spreadsheet;
