// Variation 5: Excel-density grouped table with expandable nested quantity variants
// 3-level: Client → Deal (with ▶) → quantity variants

const v5Styles = {
  wrap: { fontFamily:"'Zen Kaku Gothic New', sans-serif", color:'#0a0a0a', background:'#fff', border:'1px solid rgba(0,0,0,0.06)', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column', position:'relative' },
  toolbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid rgba(0,0,0,0.06)', gap:12 },
  scroll: { overflow:'auto', maxHeight:780 },
  table: { borderCollapse:'separate', borderSpacing:0, width:'100%', fontSize:11, fontVariantNumeric:'tabular-nums' },
  th: { position:'sticky', top:0, zIndex:3, background:'#fafaf9', padding:'8px 10px', textAlign:'left', fontWeight:500, color:'#888', fontSize:10, borderBottom:'1px solid rgba(0,0,0,0.08)', whiteSpace:'nowrap', letterSpacing:'0.02em', textTransform:'uppercase' },
  thNum: { textAlign:'right' },
  td: { padding:'7px 10px', borderBottom:'1px solid rgba(0,0,0,0.04)', borderRight:'1px solid rgba(0,0,0,0.03)', background:'#fff', height:30, lineHeight:'16px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', verticalAlign:'middle' },
  tdNum: { textAlign:'right', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' },
  tdId: { fontFamily:"'Fraunces', serif", color:'#888', fontVariantNumeric:'tabular-nums', fontSize:10 },
  groupRow: { background:'#f5f5f4', cursor:'pointer' },
  variantRow: { background:'#fafaf9' },
  variantBar: { display:'inline-block', width:2, height:14, background:'#22c55e', marginRight:8, opacity:.4, verticalAlign:'middle' },
  freezeId:    { position:'sticky', left:0,    zIndex:2, minWidth:100 },
  freezeName:  { position:'sticky', left:100,  zIndex:2, minWidth:240, borderRight:'1px solid rgba(0,0,0,0.08)' },
  freezeIdHd:  { position:'sticky', left:0,    zIndex:4, minWidth:100 },
  freezeNameHd:{ position:'sticky', left:100,  zIndex:4, minWidth:240, borderRight:'1px solid rgba(0,0,0,0.08)' },
  alertBadge: { display:'inline-flex', alignItems:'center', gap:3, fontSize:9, color:'#e5a32e' },
  newRow: { background:'#fafaf9', color:'#888', fontStyle:'italic', cursor:'pointer' },
  footer: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderTop:'1px solid rgba(0,0,0,0.06)', fontSize:11, color:'#888', background:'#fafaf9' },
};

function V5Nested() {
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [openClients, setOpenClients] = React.useState(() => new Set(window.CLIENTS.map(c => c.id)));
  const [openDeals, setOpenDeals] = React.useState(() => new Set());
  // local mutable variants store: { [dealId]: variants[] } — overrides DEALS.variants when present
  const [variantStore, setVariantStore] = React.useState({});
  const getVariants = (deal) => variantStore[deal.id] || deal.variants;
  const setVariants = (dealId, fnOrArr) => {
    setVariantStore(s => {
      const cur = s[dealId] || (window.DEALS.find(d => d.id === dealId)?.variants || []);
      const next = typeof fnOrArr === 'function' ? fnOrArr(cur) : fnOrArr;
      return { ...s, [dealId]: next };
    });
  };
  // editing a variant: { dealId, idx, qty, unit_usd, note }
  const [editVariant, setEditVariant] = React.useState(null);

  // newDealFor: client id where a new deal row is being entered (or 'new-client' for top-level new)
  const [newDealFor, setNewDealFor] = React.useState(null);
  const [newDealName, setNewDealName] = React.useState('');
  // newVariantFor: deal id where a new variant row is being entered
  const [newVariantFor, setNewVariantFor] = React.useState(null);
  const [newVariantQty, setNewVariantQty] = React.useState('');
  const [newVariantUnit, setNewVariantUnit] = React.useState('');
  const [newVariantNote, setNewVariantNote] = React.useState('');
  // showNewClient: top-level new-deal popover open
  const [showNewClient, setShowNewClient] = React.useState(false);
  // detail modal
  const [detailDeal, setDetailDeal] = React.useState(null);
  // new client modal
  const [showNewClientModal, setShowNewClientModal] = React.useState(false);
  // status changer
  const [statusChange, setStatusChange] = React.useState(null); // { deal, anchor }

  // Compute variant from qty + unit_usd (FX 155, cost ratio 0.55)
  const computeVariant = (qty, unit_usd, note) => {
    const q = Number(qty) || 0;
    const u = Number(unit_usd) || 0;
    const total_jpy = Math.round(q * u * 155 / 0.55);
    const profit_pct = 45 - Math.max(0, (5000 - q) / 1000); // simple mock model
    return { qty:q, unit_usd:u, total_jpy, profit_pct: Math.max(15, Math.min(50, profit_pct)), version:'v?', note: note || `${q.toLocaleString()}個` };
  };
  const adoptVariant = (dealId, idx) => {
    setVariants(dealId, (cur) => cur.map((v, i) => ({ ...v, note: i === idx ? 'メイン' : (v.note === 'メイン' ? `${v.qty.toLocaleString()}個` : v.note) })));
  };
  const removeVariant = (dealId, idx) => {
    setVariants(dealId, (cur) => cur.filter((_, i) => i !== idx));
  };
  const addNewVariant = (dealId) => {
    if (!newVariantQty || !newVariantUnit) { commitNewVariant(); return; }
    const v = computeVariant(newVariantQty, newVariantUnit, newVariantNote || `${Number(newVariantQty).toLocaleString()}個`);
    setVariants(dealId, (cur) => [...cur, v]);
    commitNewVariant();
  };
  const commitEditVariant = () => {
    if (!editVariant) return;
    const { dealId, idx, qty, unit_usd, note } = editVariant;
    setVariants(dealId, (cur) => cur.map((v, i) => i === idx ? { ...v, ...computeVariant(qty, unit_usd, note || v.note), note: note || v.note } : v));
    setEditVariant(null);
  };

  const startNewDeal = (cid) => {
    // ensure client is open so the row is visible
    const n = new Set(openClients); n.add(cid); setOpenClients(n);
    setNewDealFor(cid);
    setNewDealName('');
    setShowNewClient(false);
    setTimeout(() => { const el = document.getElementById('v5-new-deal-input'); if (el) el.focus(); }, 30);
  };
  const commitNewDeal = () => {
    if (newDealName.trim()) {
      // In a real app this would persist. For demo: just clear input, keep row visible briefly.
      // Could push into DEALS but DEALS is module-scope; skip persistence in mock.
    }
    setNewDealFor(null); setNewDealName('');
  };
  const startNewVariant = (dealId) => {
    setNewVariantFor(dealId);
    setNewVariantQty(''); setNewVariantUnit(''); setNewVariantNote('');
    setTimeout(() => { const el = document.getElementById('v5-new-variant-qty'); if (el) el.focus(); }, 30);
  };
  const commitNewVariant = () => { setNewVariantFor(null); setNewVariantQty(''); setNewVariantUnit(''); setNewVariantNote(''); };

  const cols = [
    { k:'id', label:'ID', w:100, freeze:'id' },
    { k:'name', label:'案件名', w:240, freeze:'name' },
    { k:'spec', label:'仕様', w:220 },
    { k:'qty', label:'数量', w:80, num:true },
    { k:'unit_usd', label:'単価USD', w:80, num:true },
    { k:'total_jpy', label:'請求合計', w:110, num:true },
    { k:'profit', label:'粗利', w:60, num:true },
    { k:'status', label:'ステータス', w:130 },
    { k:'delivery', label:'希望納期', w:90 },
    { k:'factory', label:'工場', w:130 },
    { k:'sales', label:'担当', w:60 },
    { k:'version', label:'Ver', w:50 },
    { k:'updated', label:'更新', w:80 },
    { k:'memo', label:'メモ', w:200 },
  ];

  const filtered = React.useMemo(() => {
    let r = window.DEALS;
    if (filter === 'active') r = r.filter(d => d.status !== 'delivered');
    if (filter === 'urgent') r = r.filter(window.isUrgent);
    if (filter === 'stale') r = r.filter(window.isStale);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(d => d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q) || window.clientById(d.client).name.toLowerCase().includes(q));
    }
    return r;
  }, [filter, search]);

  const groups = React.useMemo(() => {
    const m = new Map();
    for (const d of filtered) { if (!m.has(d.client)) m.set(d.client, []); m.get(d.client).push(d); }
    for (const arr of m.values()) arr.sort((a,b) => window.STATUS_ORDER.indexOf(a.status) - window.STATUS_ORDER.indexOf(b.status));
    return Array.from(m.entries()).map(([cid, deals]) => ({
      cid, name: window.clientById(cid).name, deals,
      total: deals.reduce((s,d) => s + d.total_jpy, 0),
      active: deals.filter(d => d.status !== 'delivered').length,
      avgProfit: deals.reduce((s,d) => s + d.profit_pct, 0) / deals.length,
    })).sort((a,b) => b.total - a.total);
  }, [filtered]);

  const toggleClient = (cid) => { const n = new Set(openClients); n.has(cid) ? n.delete(cid) : n.add(cid); setOpenClients(n); };
  const toggleDeal = (id) => { const n = new Set(openDeals); n.has(id) ? n.delete(id) : n.add(id); setOpenDeals(n); };
  const totalRev = filtered.reduce((s,d) => s + d.total_jpy, 0);

  return (
    <div style={v5Styles.wrap}>
      <div style={v5Styles.toolbar}>
        <div style={{ display:'flex', gap:2 }}>
          {[['all','すべて',window.DEALS.length],['active','進行中',window.DEALS.filter(d => d.status !== 'delivered').length],['urgent','納期 ≤14日',window.DEALS.filter(window.isUrgent).length],['stale','停滞',window.DEALS.filter(window.isStale).length]].map(([k,l,c]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ padding:'5px 12px', borderRadius:9999, fontSize:12, border:'none', cursor:'pointer', background: filter===k ? '#0a0a0a' : 'transparent', color: filter===k ? '#fff' : '#888', fontFamily: filter===k ? "'Fraunces', serif" : 'inherit', fontWeight: filter===k ? 600 : 400 }}>
              {l} <span style={{ opacity:.6, marginLeft:4, fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{c}</span>
            </button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'#f5f5f4', borderRadius:8, padding:'5px 10px', flex:1, maxWidth:280 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input style={{ border:'none', outline:'none', background:'transparent', fontSize:12, fontFamily:'inherit', flex:1 }} placeholder="検索" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => openDeals.size > 0 ? setOpenDeals(new Set()) : setOpenDeals(new Set(window.DEALS.map(d => d.id)))} style={{ background:'#fff', color:'#555', border:'1px solid #e8e8e6', borderRadius:8, padding:'5px 11px', fontSize:11, cursor:'pointer' }}>
          {openDeals.size > 0 ? '全バリエ閉じる' : '全バリエ開く'}
        </button>
        <button onClick={() => setShowNewClient(s => !s)} style={{ background:'#0a0a0a', color:'#fff', borderRadius:8, padding:'5px 12px', fontSize:12, border:'none', cursor:'pointer', fontWeight:500, whiteSpace:'nowrap', position:'relative' }}>+ 新規案件</button>
      </div>
      {showNewClient && (
        <div style={{ position:'absolute', top:54, right:14, zIndex:10, background:'#fff', border:'1px solid #e8e8e6', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.08)', padding:14, width:260 }}>
          <div style={{ fontSize:11, color:'#888', marginBottom:8, fontWeight:500 }}>クライアントを選択</div>
          <div style={{ display:'flex', flexDirection:'column', gap:2, maxHeight:240, overflow:'auto' }}>
            {window.CLIENTS.map(c => (
              <button key={c.id} onClick={() => startNewDeal(c.id)} style={{ textAlign:'left', padding:'7px 10px', background:'transparent', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'inherit', color:'#0a0a0a' }} onMouseEnter={e => e.currentTarget.style.background='#f5f5f4'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>{c.name}</button>
            ))}
          </div>
          <div onClick={() => { setShowNewClient(false); setShowNewClientModal(true); }} style={{ borderTop:'1px solid #f0f0ee', marginTop:8, paddingTop:8, fontSize:11, color:'#0a0a0a', cursor:'pointer', padding:'10px 10px 4px', fontWeight:500 }} onMouseEnter={e => e.currentTarget.style.background='#f5f5f4'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>+ 新規クライアントを作成</div>
        </div>
      )}

      <div style={v5Styles.scroll}>
        <table style={v5Styles.table}>
          <thead>
            <tr>{cols.map(c => {
              let s = { ...v5Styles.th, width:c.w, minWidth:c.w };
              if (c.num) s = { ...s, ...v5Styles.thNum };
              if (c.freeze === 'id') s = { ...s, ...v5Styles.freezeIdHd };
              if (c.freeze === 'name') s = { ...s, ...v5Styles.freezeNameHd };
              return <th key={c.k} style={s}>{c.label}</th>;
            })}</tr>
          </thead>
          <tbody>
            {groups.map(g => {
              const cOpen = openClients.has(g.cid);
              return (
                <React.Fragment key={g.cid}>
                  {/* Client group header */}
                  <tr style={v5Styles.groupRow} onClick={() => toggleClient(g.cid)}>
                    <td colSpan={cols.length} style={{ ...v5Styles.td, ...v5Styles.groupRow, padding:'9px 12px', position:'sticky', left:0, borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:9, color:'#888', transform: cOpen ? 'rotate(90deg)' : 'none', transition:'transform .15s', display:'inline-block' }}>▶</span>
                        <span style={{ fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:13, color:'#0a0a0a' }}>{g.name}</span>
                        <span style={{ fontSize:10, color:'#888', fontWeight:400 }}>
                          <span className="num" style={{ color:'#0a0a0a' }}>{g.deals.length}</span> 件
                          ・進行中 <span className="num" style={{ color:'#0a0a0a' }}>{g.active}</span>
                          ・平均粗利 <span className="num" style={{ color:'#0a0a0a' }}>{g.avgProfit.toFixed(1)}%</span>
                        </span>
                        <span style={{ marginLeft:14, fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:12, fontWeight:600, color:'#0a0a0a' }}>{window.fmtJPY(g.total)}</span>
                      </span>
                    </td>
                  </tr>
                  {cOpen && g.deals.map(d => {
                    const stale = window.isStale(d);
                    const urgent = window.isUrgent(d);
                    const dOpen = openDeals.has(d.id);
                    const rowBg = stale || urgent ? '#fffaf2' : '#fff';
                    const dUntil = window.daysUntil(d.delivery);
                    const dealVariants = getVariants(d);
                    return (
                      <React.Fragment key={d.id}>
                        {/* Deal main row */}
                        <tr onClick={() => setDetailDeal(d)} style={{ cursor:'pointer' }}>
                          {cols.map(c => {
                            let style = { ...v5Styles.td, background:rowBg, width:c.w, minWidth:c.w };
                            if (c.num) style = { ...style, ...v5Styles.tdNum };
                            if (c.freeze === 'id') style = { ...style, ...v5Styles.freezeId, background:rowBg };
                            if (c.freeze === 'name') style = { ...style, ...v5Styles.freezeName, background:rowBg };
                            let content = null;
                            if (c.k === 'id') content = (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                                <span onClick={(e) => { e.stopPropagation(); toggleDeal(d.id); }} style={{ fontSize:8, color:'#888', cursor:'pointer', display:'inline-block', width:10, transform: dOpen ? 'rotate(90deg)' : 'none', transition:'transform .15s', userSelect:'none' }}>▶</span>
                                <span style={v5Styles.tdId}>{d.id}</span>
                              </span>
                            );
                            else if (c.k === 'name') content = (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                                <span style={{ fontWeight:500, color:'#0a0a0a', overflow:'hidden', textOverflow:'ellipsis' }}>{d.name}</span>
                                {urgent && <span style={v5Styles.alertBadge}>● 納期</span>}
                                {stale && !urgent && <span style={{ ...v5Styles.alertBadge, color:'#888' }}>● 停滞</span>}
                                <span style={{ marginLeft:'auto', fontSize:9, color:'#bbb', fontFamily:"'Fraunces', serif" }}>{d.variants.length}案</span>
                              </span>
                            );
                            else if (c.k === 'spec') content = <window.InlineCell value={d.spec} type="text" />;
                            else if (c.k === 'qty') content = <window.InlineCell value={d.qty} type="number" align="right" format={(v) => Number(v).toLocaleString()} />;
                            else if (c.k === 'unit_usd') content = <window.InlineCell value={d.unit_usd} type="number" align="right" format={(v) => window.fmtUSDsmall(Number(v))} />;
                            else if (c.k === 'total_jpy') content = <span style={{ fontWeight:500 }}><window.MoneyHover jpy={d.total_jpy} usd={d.unit_usd} qty={d.qty} /></span>;
                            else if (c.k === 'profit') content = <span style={{ color: d.profit_pct >= 35 ? '#15803d' : d.profit_pct >= 25 ? '#0a0a0a' : '#e5a32e' }}>{d.profit_pct.toFixed(1)}%</span>;
                            else if (c.k === 'status') content = <span onClick={(e) => { e.stopPropagation(); setStatusChange({ deal: d, anchor: e.currentTarget }); }} style={{ cursor:'pointer' }}><window.StatusPill status={d.status} /></span>;
                            else if (c.k === 'delivery') content = <window.InlineCell value={d.delivery} type="date" align="left" format={(v) => window.fmtDate(v)} />;
                            else if (c.k === 'factory') content = <window.InlineCell value={d.factory} type="select" options={window.FACTORIES} />;
                            else if (c.k === 'sales') content = <window.InlineCell value={d.sales} type="select" options={window.SALES} />;
                            else if (c.k === 'version') content = <span style={{ color:'#888', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{d.version}</span>;
                            else if (c.k === 'updated') content = <span style={{ color:'#888', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{window.fmtDate(d.updated)}</span>;
                            else if (c.k === 'memo') content = <window.InlineCell value={d.memo} type="text" format={(v) => v || '—'} />;
                            return <td key={c.k} style={style} title={c.k === 'memo' ? d.memo : undefined}>{content}</td>;
                          })}
                        </tr>
                        {/* Variant rows (expandable) */}
                        {dOpen && dealVariants.map((v, vi) => {
                          const isMain = v.note === 'メイン';
                          const isEditing = editVariant && editVariant.dealId === d.id && editVariant.idx === vi;
                          if (isEditing) {
                            const previewJpy = Math.round((Number(editVariant.qty) || 0) * (Number(editVariant.unit_usd) || 0) * 155 / 0.55);
                            return (
                              <tr key={d.id + '-v' + vi} style={{ background:'#fffef5' }}>
                                <td colSpan={cols.length} style={{ ...v5Styles.td, background:'#fffef5', position:'sticky', left:0, padding:'8px 14px 8px 38px', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                                  <span style={{ display:'inline-flex', alignItems:'center', gap:10, fontSize:11, flexWrap:'wrap' }}>
                                    <span style={{ color:'#888' }}>編集:</span>
                                    <span style={{ color:'#888' }}>ラベル</span>
                                    <input value={editVariant.note} onChange={e => setEditVariant({ ...editVariant, note: e.target.value })} placeholder="例 大量 / 試作" style={{ width:120, border:'1px solid #e8e8e6', borderRadius:5, padding:'3px 6px', fontSize:11, outline:'none', fontFamily:'inherit' }} />
                                    <span style={{ color:'#888' }}>数量</span>
                                    <input value={editVariant.qty} onChange={e => setEditVariant({ ...editVariant, qty: e.target.value })} style={{ width:80, border:'1px solid #e8e8e6', borderRadius:5, padding:'3px 6px', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:11, outline:'none' }} onKeyDown={e => { if (e.key === 'Enter') commitEditVariant(); if (e.key === 'Escape') setEditVariant(null); }} />
                                    <span style={{ color:'#888' }}>単価USD</span>
                                    <input value={editVariant.unit_usd} onChange={e => setEditVariant({ ...editVariant, unit_usd: e.target.value })} style={{ width:80, border:'1px solid #e8e8e6', borderRadius:5, padding:'3px 6px', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:11, outline:'none' }} onKeyDown={e => { if (e.key === 'Enter') commitEditVariant(); if (e.key === 'Escape') setEditVariant(null); }} />
                                    <span style={{ color:'#0a0a0a', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>→ {window.fmtJPY(previewJpy)}</span>
                                    <button onClick={commitEditVariant} style={{ background:'#0a0a0a', color:'#fff', border:'none', borderRadius:5, padding:'3px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>保存</button>
                                    <button onClick={() => setEditVariant(null)} style={{ background:'transparent', color:'#888', border:'none', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>キャンセル</button>
                                  </span>
                                </td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={d.id + '-v' + vi} style={v5Styles.variantRow}>
                              {cols.map(c => {
                                let style = { ...v5Styles.td, background:'#fafaf9', width:c.w, minWidth:c.w };
                                if (c.num) style = { ...style, ...v5Styles.tdNum };
                                if (c.freeze === 'id') style = { ...style, ...v5Styles.freezeId, background:'#fafaf9' };
                                if (c.freeze === 'name') style = { ...style, ...v5Styles.freezeName, background:'#fafaf9' };
                                let content = null;
                                if (c.k === 'id') content = (
                                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, paddingLeft:18 }}>
                                    <span style={{ ...v5Styles.variantBar, background: isMain ? '#22c55e' : '#d8d8d4', opacity: isMain ? 1 : 0.5 }}></span>
                                    <span style={{ ...v5Styles.tdId, color: isMain ? '#22c55e' : '#bbb' }}>{v.version}</span>
                                  </span>
                                );
                                else if (c.k === 'name') content = (
                                  <span style={{ paddingLeft:14, color:'#555', fontStyle:'italic', fontSize:10.5, display:'inline-flex', alignItems:'center', gap:6 }}>
                                    {v.note}{isMain && <span style={{ color:'#22c55e', marginLeft:6, fontWeight:500, fontStyle:'normal' }}>● 採用中</span>}
                                  </span>
                                );
                                else if (c.k === 'spec') content = <span style={{ color:'#bbb', fontSize:10, fontStyle:'italic' }}>(同仕様)</span>;
                                else if (c.k === 'qty') content = <span style={{ color:'#0a0a0a' }}>{v.qty.toLocaleString()}</span>;
                                else if (c.k === 'unit_usd') content = <span style={{ color:'#0a0a0a' }}>{window.fmtUSDsmall(v.unit_usd)}</span>;
                                else if (c.k === 'total_jpy') content = <span style={{ color:'#0a0a0a', fontWeight: isMain ? 600 : 400 }}><window.MoneyHover jpy={v.total_jpy} usd={v.unit_usd} qty={v.qty} /></span>;
                                else if (c.k === 'profit') content = <span style={{ color: v.profit_pct >= 35 ? '#15803d' : v.profit_pct >= 25 ? '#0a0a0a' : '#e5a32e' }}>{v.profit_pct.toFixed(1)}%</span>;
                                else if (c.k === 'version') content = <span style={{ color:'#888', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{v.version}</span>;
                                else if (c.k === 'memo') content = (
                                  <span style={{ display:'inline-flex', gap:6, fontSize:10 }}>
                                    {!isMain && <span onClick={() => adoptVariant(d.id, vi)} style={{ color:'#15803d', cursor:'pointer', borderBottom:'1px dotted #15803d' }}>採用</span>}
                                    <span onClick={() => setEditVariant({ dealId:d.id, idx:vi, qty:v.qty, unit_usd:v.unit_usd, note: v.note === 'メイン' ? '' : v.note })} style={{ color:'#0a0a0a', cursor:'pointer', borderBottom:'1px dotted #0a0a0a' }}>編集</span>
                                    <span onClick={() => removeVariant(d.id, vi)} style={{ color:'#dc2626', cursor:'pointer', borderBottom:'1px dotted #dc2626' }}>削除</span>
                                  </span>
                                );
                                else content = <span style={{ color:'#ccc' }}>—</span>;
                                return <td key={c.k} style={style}>{content}</td>;
                              })}
                            </tr>
                          );
                        })}
                        {dOpen && newVariantFor === d.id && (
                          <tr style={{ background:'#fffef5' }}>
                            <td colSpan={cols.length} style={{ ...v5Styles.td, background:'#fffef5', position:'sticky', left:0, padding:'8px 14px 8px 38px', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:10, fontSize:11, flexWrap:'wrap' }}>
                                <span style={{ color:'#888' }}>新バリエーション:</span>
                                <span style={{ color:'#888' }}>ラベル</span>
                                <input value={newVariantNote} onChange={e => setNewVariantNote(e.target.value)} placeholder="例 大量 / 試作" style={{ width:120, border:'1px solid #e8e8e6', borderRadius:5, padding:'3px 6px', fontSize:11, outline:'none', fontFamily:'inherit' }} />
                                <span style={{ color:'#888' }}>数量</span>
                                <input id="v5-new-variant-qty" value={newVariantQty} onChange={e => setNewVariantQty(e.target.value)} placeholder="例 2000" style={{ width:80, border:'1px solid #e8e8e6', borderRadius:5, padding:'3px 6px', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:11, outline:'none' }} onKeyDown={e => { if (e.key === 'Enter') { document.getElementById('v5-new-variant-unit').focus(); } if (e.key === 'Escape') commitNewVariant(); }} />
                                <span style={{ color:'#888' }}>単価USD</span>
                                <input id="v5-new-variant-unit" value={newVariantUnit} onChange={e => setNewVariantUnit(e.target.value)} placeholder="例 0.85" style={{ width:80, border:'1px solid #e8e8e6', borderRadius:5, padding:'3px 6px', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:11, outline:'none' }} onKeyDown={e => { if (e.key === 'Enter') addNewVariant(d.id); if (e.key === 'Escape') commitNewVariant(); }} />
                                {newVariantQty && newVariantUnit && (
                                  <span style={{ color:'#0a0a0a', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>
                                    → {window.fmtJPY(Math.round(Number(newVariantQty) * Number(newVariantUnit) * 155 / 0.55))}
                                  </span>
                                )}
                                <button onClick={() => addNewVariant(d.id)} disabled={!newVariantQty || !newVariantUnit} style={{ background: newVariantQty && newVariantUnit ? '#0a0a0a' : '#e8e8e6', color:'#fff', border:'none', borderRadius:5, padding:'3px 10px', fontSize:11, cursor: newVariantQty && newVariantUnit ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>追加</button>
                                <button onClick={commitNewVariant} style={{ background:'transparent', color:'#888', border:'none', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>キャンセル</button>
                              </span>
                            </td>
                          </tr>
                        )}
                        {dOpen && newVariantFor !== d.id && (
                          <tr>
                            <td colSpan={cols.length} style={{ ...v5Styles.td, background:'#fafaf9', position:'sticky', left:0, padding:'4px 14px 4px 38px', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                              <button onClick={() => startNewVariant(d.id)} style={{ background:'#fff', color:'#555', border:'1px dashed #d8d8d4', borderRadius:6, padding:'3px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:5 }} onMouseEnter={e => { e.currentTarget.style.borderColor='#0a0a0a'; e.currentTarget.style.color='#0a0a0a'; }} onMouseLeave={e => { e.currentTarget.style.borderColor='#d8d8d4'; e.currentTarget.style.color='#555'; }}>
                                <span style={{ fontSize:13, lineHeight:1 }}>+</span> 数量・価格バリエーションを追加
                              </button>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {cOpen && newDealFor === g.cid && (
                    <tr style={{ background:'#fffef5' }}>
                      <td colSpan={cols.length} style={{ ...v5Styles.td, background:'#fffef5', position:'sticky', left:0, padding:'8px 14px 8px 32px', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:10, fontSize:11 }}>
                          <span style={{ color:'#888' }}>新規見積:</span>
                          <input id="v5-new-deal-input" value={newDealName} onChange={e => setNewDealName(e.target.value)} placeholder="案件名を入力（例: 化粧品ボトル / 蓋付き）" style={{ width:340, border:'1px solid #e8e8e6', borderRadius:5, padding:'4px 8px', fontSize:12, outline:'none', fontFamily:'inherit' }} onKeyDown={e => { if (e.key === 'Enter') commitNewDeal(); if (e.key === 'Escape') { setNewDealFor(null); setNewDealName(''); } }} />
                          <span style={{ color:'#bbb', fontSize:10 }}>Enter で追加 / Esc でキャンセル</span>
                          <button onClick={commitNewDeal} disabled={!newDealName.trim()} style={{ background: newDealName.trim() ? '#0a0a0a' : '#e8e8e6', color:'#fff', border:'none', borderRadius:5, padding:'4px 12px', fontSize:11, cursor: newDealName.trim() ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>追加</button>
                        </span>
                      </td>
                    </tr>
                  )}
                  {cOpen && newDealFor !== g.cid && (
                    <tr>
                      <td colSpan={cols.length} style={{ ...v5Styles.td, background:'#fff', position:'sticky', left:0, padding:'6px 14px 6px 32px', borderBottom:'1px solid rgba(0,0,0,0.04)' }}>
                        <button onClick={() => startNewDeal(g.cid)} style={{ background:'transparent', color:'#888', border:'none', fontSize:11, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:5, padding:'2px 6px', borderRadius:4 }} onMouseEnter={e => { e.currentTarget.style.background='#f5f5f4'; e.currentTarget.style.color='#0a0a0a'; }} onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#888'; }}>
                          <span style={{ fontSize:13, lineHeight:1 }}>+</span> {g.name} に新しい見積を追加
                        </button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={v5Styles.footer}>
        <span>{filtered.length} 件 ・ クライアント {groups.length} 社</span>
        <span>合計請求 <span style={{ color:'#0a0a0a', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontWeight:600 }}>{window.fmtJPY(totalRev)}</span></span>
      </div>
      {detailDeal && <window.DealDetailModal deal={detailDeal} onClose={() => setDetailDeal(null)} />}
      {showNewClientModal && <window.NewClientModal onClose={() => setShowNewClientModal(false)} />}
      {statusChange && <window.StatusChanger deal={statusChange.deal} anchor={statusChange.anchor} onClose={() => setStatusChange(null)} onChange={(s) => { /* in real app: persist; demo: ignore */ }} />}
    </div>
  );
}

window.V5Nested = V5Nested;
