// Final integrated App — wires all parts

function FinalApp() {
  const [page, setPage] = React.useState('deals');
  const [selectedDeal, setSelectedDeal] = React.useState(window.DEALS[0]);
  const [paneOpen, setPaneOpen] = React.useState(true);
  const [cmdkOpen, setCmdkOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [ccy, setCcy] = React.useState('JPY');
  const [toast, setToast] = React.useState(null);

  // Cmd+K handler
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdkOpen(true); }
      if (e.key === 'Escape') { setCmdkOpen(false); setNotifOpen(false); }
      // j/k navigation when no input focused
      if (!cmdkOpen && document.activeElement.tagName !== 'INPUT' && !document.activeElement.isContentEditable) {
        if (e.key === 'j' || e.key === 'k') {
          const list = window.DEALS;
          const idx = list.findIndex(d => d.id === (selectedDeal && selectedDeal.id));
          const ni = e.key === 'j' ? Math.min(list.length-1, idx+1) : Math.max(0, idx-1);
          setSelectedDeal(list[ni]);
          setPaneOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmdkOpen, selectedDeal]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const onCmdSelect = (it) => {
    if (it.k === 'deal') { setPage('deals'); setSelectedDeal(it.d); setPaneOpen(true); }
    if (it.k === 'client') { setPage('master'); }
    if (it.k === 'factory') { setPage('master'); }
    if (it.k === 'action') {
      if (it.a === 'new_invoice') { setPage('docs'); }
      if (it.a === 'new_quotation') { setPage('docs'); }
      if (it.a === 'new_deal') showToast('新規案件モーダルを開く（モック）');
    }
    setCmdkOpen(false);
  };

  const onNotifSelect = (n) => {
    const d = window.DEALS.find(x => x.id === n.deal);
    if (d) { setPage('deals'); setSelectedDeal(d); setPaneOpen(true); }
  };

  const onCreateDoc = (kind) => {
    const map = { quotation:'見積書', invoice:'請求書', delivery:'納品書', po:'見積依頼書' };
    showToast(`${map[kind] || '帳票'}を生成しました`);
  };

  const pageMeta = {
    home: { title:'ホーム', sub:'今日の概要と要対応' },
    deals: { title:'案件', sub:`${window.DEALS.length}件 · ${window.DEALS.filter(d => d.status !== 'delivered').length}件進行中` },
    master: { title:'取引先', sub:`クライアント${window.CLIENTS.length} · 工場${window.FACTORIES_DATA.length}` },
    docs: { title:'帳票ハブ', sub:'見積・請求・納品・見積依頼' },
  };

  // Right pane only on deals page
  const showPane = page === 'deals' && paneOpen;

  return (
    <div style={window.shStyles.app}>
      <window.NavRail page={page} onChange={(p) => { setPage(p); }} />

      <div style={window.shStyles.main}>
        <window.TopBar
          page={pageMeta[page]}
          onSearch={() => setCmdkOpen(true)}
          onToggleNotif={() => setNotifOpen(!notifOpen)}
          notifCount={window.NOTIFICATIONS.length}
          onPrimary={() => showToast('新規案件モーダルを開く（モック）')}
          ccy={ccy} onCcy={setCcy}
        />

        <div style={window.shStyles.content}>
          <div style={window.shStyles.centerCol}>
            {page === 'home' && <window.Dashboard />}
            {page === 'deals' && <window.FinalDealsView selectedId={selectedDeal && selectedDeal.id} onSelect={(d) => { setSelectedDeal(d); setPaneOpen(true); }} ccy={ccy} />}
            {page === 'master' && <window.FinalMaster onOpenDeal={(d) => { setPage('deals'); setSelectedDeal(d); setPaneOpen(true); }} />}
            {page === 'docs' && <window.FinalDocsHub onCreateDoc={onCreateDoc} />}
          </div>

          {showPane && (
            <div style={window.shStyles.pane}>
              <window.FinalDealPane deal={selectedDeal} ccy={ccy} onClose={() => setPaneOpen(false)} onCreateDoc={onCreateDoc} />
            </div>
          )}
          {page === 'deals' && !paneOpen && (
            <button onClick={() => setPaneOpen(true)} style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', writingMode:'vertical-rl', padding:'10px 6px', border:'1px solid #e8e8e6', borderRight:'none', background:'#fff', cursor:'pointer', fontSize:10, color:'#888', fontFamily:'inherit', borderRadius:'6px 0 0 6px' }}>← 詳細パネル</button>
          )}
        </div>
      </div>

      {cmdkOpen && <window.CmdK onClose={() => setCmdkOpen(false)} onSelect={onCmdSelect} />}
      {notifOpen && <window.NotifPopover onClose={() => setNotifOpen(false)} onSelect={onNotifSelect} />}
      {toast && <div style={window.shStyles.toast}><span style={{ color:'#22c55e' }}>✓</span>{toast}</div>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<FinalApp />);
