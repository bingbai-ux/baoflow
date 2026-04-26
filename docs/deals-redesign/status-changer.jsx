// Status Change Flow — clickable status pill that opens a step-by-step changer
// Shows the 7-step pipeline visually, lets user advance/rewind, and triggers actions per step

const scStyles = {
  popover: { position:'absolute', background:'#fff', border:'1px solid #e8e8e6', borderRadius:12, boxShadow:'0 12px 32px rgba(0,0,0,0.15)', padding:'16px 18px', width:340, zIndex:400, fontFamily:"'Zen Kaku Gothic New', sans-serif" },
  title: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:13, color:'#0a0a0a', marginBottom:3 },
  subtitle: { fontSize:10, color:'#888', marginBottom:14 },
  pipeline: { display:'flex', flexDirection:'column', gap:0, marginBottom:14 },
  step: { display:'flex', alignItems:'center', gap:10, padding:'7px 8px', borderRadius:6, cursor:'pointer', fontSize:11.5, position:'relative' },
  stepDot: { width:18, height:18, borderRadius:'50%', flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:9, fontFamily:"'Fraunces', serif", fontWeight:600 },
  stepLine: { position:'absolute', left:16, top:25, width:2, height:'calc(100% - 16px)', background:'#e8e8e6' },
  stepLabel: { flex:1, fontWeight:500, color:'#0a0a0a' },
  stepDate: { fontSize:9, color:'#bbb', fontFamily:"'Fraunces', serif" },
  actionBox: { background:'#fafaf9', borderLeft:'2px solid #0a0a0a', padding:'10px 12px', fontSize:11, color:'#555', lineHeight:1.6, marginBottom:12, borderRadius:'0 6px 6px 0' },
  actionTitle: { color:'#0a0a0a', fontWeight:500, marginBottom:4, fontSize:11 },
  buttonRow: { display:'flex', gap:6, justifyContent:'flex-end' },
  btn: { padding:'6px 12px', fontSize:11, borderRadius:5, border:'none', cursor:'pointer', fontFamily:'inherit' },
  btnPrimary: { background:'#0a0a0a', color:'#fff', fontWeight:500 },
  btnSecondary: { background:'transparent', color:'#555', border:'1px solid #e8e8e6' },
};

// Per-status, what auto-action / hint to show
const STATUS_ACTIONS = {
  quoting: { hint: '工場から見積回答が届いたら次へ。', next: '見積確定済み にする' },
  quote_confirmed: { hint: 'クライアントの確認を取得後、入金待ちへ。', next: '入金待ち にする', action: '請求書を自動生成しますか？' },
  paid: { hint: '入金確認後、データ・仕様の最終確認へ。', next: 'データ確認 にする' },
  data_confirmed: { hint: '工場へ生産発注。', next: '生産中 にする', action: '発注書を自動生成しますか？' },
  in_production: { hint: '出荷準備完了で次へ。', next: '出荷済み にする' },
  shipped: { hint: '到着確認で完了。', next: '納品完了 にする' },
  delivered: { hint: '案件は完了しました。', next: null },
};

function StatusChanger({ deal, anchor, onClose, onChange }) {
  const currentIdx = window.STATUS_ORDER.indexOf(deal.status);
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const popoverRef = React.useRef(null);
  const [pos, setPos] = React.useState({ top:0, left:0 });

  React.useEffect(() => {
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.max(12, r.left) });
    }
    const onClick = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose(); };
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', onClick), 0);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, [anchor]);

  const action = STATUS_ACTIONS[deal.status] || {};
  const nextStatus = window.STATUS_ORDER[currentIdx + 1];

  return (
    <div ref={popoverRef} style={{ ...scStyles.popover, top:pos.top, left:pos.left, position:'fixed' }}>
      <div style={scStyles.title}>ステータスを変更</div>
      <div style={scStyles.subtitle}>{deal.id} · {deal.name}</div>

      <div style={scStyles.pipeline}>
        {window.STATUS_ORDER.map((s, i) => {
          const cfg = window.STATUS[s];
          const done = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture = i > currentIdx;
          const isHover = hoverIdx === i;
          const showLine = i < window.STATUS_ORDER.length - 1;
          let dotBg = '#e8e8e6', dotColor = '#888', dotIcon = i + 1;
          if (done) { dotBg = '#0a0a0a'; dotColor = '#fff'; dotIcon = '✓'; }
          if (isCurrent) { dotBg = cfg.dot; dotColor = '#fff'; dotIcon = '●'; }
          return (
            <div key={s} style={{ ...scStyles.step, background: isHover ? '#fafaf9' : 'transparent' }}
                 onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}
                 onClick={() => { if (!isCurrent) onChange && onChange(s); onClose(); }}>
              <span style={{ ...scStyles.stepDot, background:dotBg, color:dotColor, border: isCurrent ? `2px solid ${cfg.dot}` : 'none', boxShadow: isCurrent ? `0 0 0 3px ${cfg.dot}33` : 'none' }}>{dotIcon}</span>
              {showLine && <span style={{ ...scStyles.stepLine, background: done ? '#0a0a0a' : '#e8e8e6' }}></span>}
              <span style={{ ...scStyles.stepLabel, color: isFuture ? '#888' : '#0a0a0a', fontWeight: isCurrent ? 600 : 500 }}>
                {cfg.label}
              </span>
              {done && <span style={scStyles.stepDate}>10/{15 + i*2}</span>}
              {isCurrent && <span style={{ fontSize:9, color: cfg.dot, fontFamily:"'Fraunces', serif", fontWeight:600 }}>現在</span>}
              {isFuture && isHover && <span style={{ fontSize:10, color:'#0a0a0a' }}>→ 進める</span>}
              {done && isHover && <span style={{ fontSize:10, color:'#888' }}>← 戻す</span>}
            </div>
          );
        })}
      </div>

      {action.hint && (
        <div style={scStyles.actionBox}>
          <div style={scStyles.actionTitle}>次のアクション</div>
          <div>{action.hint}</div>
          {action.action && <div style={{ marginTop:6, color:'#0a0a0a', fontWeight:500, fontSize:10.5 }}>💡 {action.action}</div>}
        </div>
      )}

      <div style={scStyles.buttonRow}>
        <button onClick={onClose} style={{ ...scStyles.btn, ...scStyles.btnSecondary }}>閉じる</button>
        {nextStatus && (
          <button onClick={() => { onChange && onChange(nextStatus); onClose(); }} style={{ ...scStyles.btn, ...scStyles.btnPrimary }}>
            {action.next || '次へ進める'}
          </button>
        )}
      </div>
    </div>
  );
}

window.StatusChanger = StatusChanger;
