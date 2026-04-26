// Final integrated app — Phase A+B+C combined
// One screen, view switcher, always-on right pane, cmd+k, notifications, doc gen integrated

const fappStyles = {
  // Cmd+K palette
  cmdkOverlay: { position:'fixed', inset:0, background:'rgba(10,10,10,0.4)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'10vh' },
  cmdkPanel: { width:600, maxWidth:'92vw', background:'#fff', borderRadius:14, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', overflow:'hidden', fontFamily:"'Zen Kaku Gothic New', sans-serif" },
  cmdkInput: { width:'100%', padding:'16px 20px', fontSize:14, border:'none', borderBottom:'1px solid #e8e8e6', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  cmdkResults: { maxHeight:420, overflow:'auto' },
  cmdkGroup: { padding:'8px 14px 4px', fontSize:9.5, color:'#999', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' },
  cmdkItem: { display:'flex', alignItems:'center', gap:12, padding:'10px 16px', cursor:'pointer', fontSize:12.5 },
  cmdkItemActive: { background:'#fafaf9' },
  cmdkBadge: { fontSize:9.5, color:'#888', fontFamily:"'Fraunces', serif", letterSpacing:'0.04em' },
  cmdkHint: { padding:'10px 16px', borderTop:'1px solid #e8e8e6', fontSize:10, color:'#aaa', display:'flex', gap:14 },
  cmdkKbd: { background:'#fafaf9', border:'1px solid #e8e8e6', borderRadius:3, padding:'1px 5px', fontFamily:'monospace', fontSize:9 },

  // Notifications dropdown
  notifPop: { position:'absolute', top:48, right:16, width:380, background:'#fff', border:'1px solid #e8e8e6', borderRadius:12, boxShadow:'0 16px 40px rgba(0,0,0,0.18)', zIndex:500, overflow:'hidden' },
  notifHead: { padding:'12px 16px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' },
  notifTitle: { fontFamily:"'Fraunces', serif", fontSize:13, fontWeight:600 },
  notifMark: { fontSize:11, color:'#888', cursor:'pointer' },
  notifList: { maxHeight:420, overflow:'auto' },
  notifItem: { padding:'12px 16px', borderBottom:'1px solid #f1f0ec', cursor:'pointer', display:'flex', gap:10, fontSize:11.5 },
  notifIcon: { width:24, height:24, borderRadius:'50%', background:'#fafaf9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0, fontFamily:"'Fraunces', serif" },
  notifIconUrgent: { background:'#fdeae3', color:'#c0392b' },

  // Right pane
  paneHead: { padding:'14px 16px 10px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'flex-start', gap:10 },
  paneClose: { width:24, height:24, borderRadius:6, border:'none', background:'transparent', color:'#888', cursor:'pointer', fontSize:14, marginLeft:'auto' },
  paneId: { fontFamily:"'Fraunces', serif", fontSize:10, color:'#888', letterSpacing:'0.04em' },
  paneName: { fontSize:14, fontWeight:600, marginTop:1 },
  paneTabs: { display:'flex', gap:4, padding:'8px 12px 0', borderBottom:'1px solid #e8e8e6', fontSize:11 },
  paneTab: { padding:'6px 10px', cursor:'pointer', borderBottom:'2px solid transparent', color:'#888' },
  paneTabActive: { color:'#0a0a0a', borderBottomColor:'#0a0a0a', fontWeight:600 },
  paneBody: { flex:1, overflow:'auto', padding:16, fontSize:11.5 },

  // Currency cue chip on JPY values
  ccyChip: { fontSize:8, fontFamily:"'Fraunces', serif", fontWeight:600, color:'#aaa', marginLeft:3, letterSpacing:'0.04em', verticalAlign:'middle' },
};

// Top bar
function TopBar({ page, onSearch, onToggleNotif, notifCount, onPrimary, ccy, onCcy }) {
  return (
    <div style={window.shStyles.topbar}>
      <div style={window.shStyles.pageTitle}>{page.title}</div>
      <div style={window.shStyles.pageSub}>{page.sub}</div>
      <div style={window.shStyles.topSpacer} />

      <div style={window.shStyles.search} onClick={onSearch}>
        <window.NavIcon k="search" />
        <span>案件・取引先・書類を検索</span>
        <span style={window.shStyles.searchKbd}>⌘K</span>
      </div>

      <div style={window.shStyles.ccyToggle}>
        {['JPY','USD','両方'].map(c => (
          <button key={c} onClick={() => onCcy(c)} style={{ ...window.shStyles.ccyBtn, ...(ccy===c ? window.shStyles.ccyBtnActive : {}) }}>{c}</button>
        ))}
      </div>

      <button style={window.shStyles.iconBtn} onClick={onToggleNotif} title="通知">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.6"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        {notifCount > 0 && <span style={{ ...window.shStyles.navBadge, top:-4, right:-4 }}>{notifCount}</span>}
      </button>

      <button style={window.shStyles.primaryBtn} onClick={onPrimary}>
        + 新規案件
      </button>
    </div>
  );
}

// Left rail
function NavRail({ page, onChange, notifCount }) {
  const items = [
    { k:'home', label:'ホーム', page:'home' },
    { k:'deals', label:'案件', page:'deals' },
    { k:'master', label:'取引先', page:'master' },
    { k:'docs', label:'帳票', page:'docs' },
  ];
  const [hover, setHover] = React.useState(null);
  return (
    <div style={window.shStyles.nav}>
      <div style={window.shStyles.navLogo}>B</div>
      {items.map(it => {
        const active = page === it.page;
        return (
          <div key={it.k} style={{ ...window.shStyles.navItem, ...(active ? window.shStyles.navItemActive : {}) }}
               onClick={() => onChange(it.page)} onMouseEnter={() => setHover(it.k)} onMouseLeave={() => setHover(null)}>
            <window.NavIcon k={it.k} active={active} />
            {hover === it.k && <span style={window.shStyles.navLabel}>{it.label}</span>}
          </div>
        );
      })}
      <div style={window.shStyles.navSpacer} />
      <div style={{ ...window.shStyles.navItem, color:'#777' }} onMouseEnter={() => setHover('settings')} onMouseLeave={() => setHover(null)}>
        <window.NavIcon k="settings" />
        {hover === 'settings' && <span style={window.shStyles.navLabel}>設定</span>}
      </div>
      <div style={{ width:32, height:32, borderRadius:'50%', background:'#5b6b5d', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, marginTop:8 }}>田</div>
    </div>
  );
}

// Cmd+K palette
function CmdK({ onClose, onSelect }) {
  const [q, setQ] = React.useState('');
  const [idx, setIdx] = React.useState(0);
  const inputRef = React.useRef(null);
  React.useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  const items = React.useMemo(() => {
    const ql = q.trim().toLowerCase();
    const deals = window.DEALS.filter(d =>
      !ql || d.id.toLowerCase().includes(ql) || d.name.toLowerCase().includes(ql) || d.spec.toLowerCase().includes(ql)
    ).slice(0, 6).map(d => ({ k:'deal', d, label:d.name, sub:`${d.id} · ${(window.CLIENTS.find(c=>c.id===d.client)||{}).short}`, badge:window.STATUS[d.status].short }));
    const clients = window.CLIENTS.filter(c => !ql || c.name.toLowerCase().includes(ql) || c.short.toLowerCase().includes(ql)).slice(0,4).map(c => ({ k:'client', c, label:c.name, sub:c.industry, badge:'取引先' }));
    const factories = window.FACTORIES_DATA.filter(f => !ql || f.name.toLowerCase().includes(ql) || f.city.toLowerCase().includes(ql)).slice(0,3).map(f => ({ k:'factory', f, label:f.name, sub:`${f.city} · ${f.contact}`, badge:'工場' }));
    const actions = !ql ? [
      { k:'action', a:'new_deal', label:'新規案件を作成', sub:'青葉珈琲 / KURASHI / mui tea ...から選ぶ', badge:'⌘N' },
      { k:'action', a:'new_invoice', label:'請求書を発行', sub:'採用済みの案件から一括生成', badge:'⌘I' },
      { k:'action', a:'new_quotation', label:'工場へ見積依頼を送る', sub:'Quotation Request / 询价单', badge:'⌘Q' },
    ] : [];
    return { deals, clients, factories, actions };
  }, [q]);

  const flat = [
    ...items.actions, ...items.deals, ...items.clients, ...items.factories,
  ];

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i+1, flat.length-1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i-1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); flat[idx] && onSelect(flat[idx]); }
    if (e.key === 'Escape')    { onClose(); }
  };

  return (
    <div style={fappStyles.cmdkOverlay} onClick={onClose}>
      <div style={fappStyles.cmdkPanel} onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} style={fappStyles.cmdkInput} placeholder="案件番号 · 案件名 · 取引先 · 工場名で検索…" value={q} onChange={e => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey} />
        <div style={fappStyles.cmdkResults}>
          {items.actions.length > 0 && <div style={fappStyles.cmdkGroup}>クイックアクション</div>}
          {items.actions.map((it, i) => {
            const k = i;
            return (
              <div key={'a'+i} style={{ ...fappStyles.cmdkItem, ...(idx===k ? fappStyles.cmdkItemActive : {}) }} onClick={() => onSelect(it)} onMouseEnter={() => setIdx(k)}>
                <span style={{ width:18, fontFamily:"'Fraunces', serif", color:'#0a0a0a', fontWeight:600 }}>›</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500 }}>{it.label}</div>
                  <div style={{ fontSize:10, color:'#888' }}>{it.sub}</div>
                </div>
                <span style={fappStyles.cmdkBadge}>{it.badge}</span>
              </div>
            );
          })}
          {items.deals.length > 0 && <div style={fappStyles.cmdkGroup}>案件</div>}
          {items.deals.map((it, i) => {
            const k = items.actions.length + i;
            return (
              <div key={'d'+i} style={{ ...fappStyles.cmdkItem, ...(idx===k ? fappStyles.cmdkItemActive : {}) }} onClick={() => onSelect(it)} onMouseEnter={() => setIdx(k)}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:window.STATUS[it.d.status].dot }}></span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500 }}>{it.label}</div>
                  <div style={{ fontSize:10, color:'#888' }}>{it.sub}</div>
                </div>
                <span style={fappStyles.cmdkBadge}>{it.badge}</span>
              </div>
            );
          })}
          {items.clients.length > 0 && <div style={fappStyles.cmdkGroup}>取引先</div>}
          {items.clients.map((it, i) => {
            const k = items.actions.length + items.deals.length + i;
            return (
              <div key={'c'+i} style={{ ...fappStyles.cmdkItem, ...(idx===k ? fappStyles.cmdkItemActive : {}) }} onClick={() => onSelect(it)} onMouseEnter={() => setIdx(k)}>
                <span style={{ width:18, fontFamily:"'Fraunces', serif", color:'#0a0a0a' }}>◯</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500 }}>{it.label}</div>
                  <div style={{ fontSize:10, color:'#888' }}>{it.sub}</div>
                </div>
                <span style={fappStyles.cmdkBadge}>{it.badge}</span>
              </div>
            );
          })}
          {items.factories.length > 0 && <div style={fappStyles.cmdkGroup}>工場</div>}
          {items.factories.map((it, i) => {
            const k = items.actions.length + items.deals.length + items.clients.length + i;
            return (
              <div key={'f'+i} style={{ ...fappStyles.cmdkItem, ...(idx===k ? fappStyles.cmdkItemActive : {}) }} onClick={() => onSelect(it)} onMouseEnter={() => setIdx(k)}>
                <span style={{ width:18, fontFamily:"'Fraunces', serif", color:'#0a0a0a' }}>▣</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500 }}>{it.label}</div>
                  <div style={{ fontSize:10, color:'#888' }}>{it.sub}</div>
                </div>
                <span style={fappStyles.cmdkBadge}>{it.badge}</span>
              </div>
            );
          })}
          {flat.length === 0 && <div style={{ padding:30, textAlign:'center', color:'#aaa', fontSize:12 }}>該当なし</div>}
        </div>
        <div style={fappStyles.cmdkHint}>
          <span><span style={fappStyles.cmdkKbd}>↑↓</span> 移動</span>
          <span><span style={fappStyles.cmdkKbd}>↵</span> 選択</span>
          <span><span style={fappStyles.cmdkKbd}>esc</span> 閉じる</span>
        </div>
      </div>
    </div>
  );
}

// Notifications popover
function NotifPopover({ onClose, onSelect }) {
  const popRef = React.useRef(null);
  React.useEffect(() => {
    const onClick = (e) => { if (popRef.current && !popRef.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener('mousedown', onClick), 0);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  return (
    <div ref={popRef} style={fappStyles.notifPop}>
      <div style={fappStyles.notifHead}>
        <div style={fappStyles.notifTitle}>通知 ({window.NOTIFICATIONS.length})</div>
        <div style={fappStyles.notifMark}>すべて既読</div>
      </div>
      <div style={fappStyles.notifList}>
        {window.NOTIFICATIONS.map(n => (
          <div key={n.id} style={fappStyles.notifItem} onClick={() => { onSelect(n); onClose(); }}>
            <div style={{ ...fappStyles.notifIcon, ...(n.urgent ? fappStyles.notifIconUrgent : {}) }}>{n.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:500, marginBottom:2 }}>{n.title}</div>
              <div style={{ color:'#888', fontSize:10.5, lineHeight:1.5 }}>{n.body}</div>
              <div style={{ color:'#bbb', fontSize:10, marginTop:3, fontFamily:"'Fraunces', serif" }}>{n.when}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.shStyles = window.shStyles; // keep linter happy
window.fappStyles = fappStyles;
window.TopBar = TopBar;
window.NavRail = NavRail;
window.CmdK = CmdK;
window.NotifPopover = NotifPopover;
