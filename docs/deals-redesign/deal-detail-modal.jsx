// Deal Detail Modal — opens when clicking a deal row
// Tabbed: 詳細 | 履歴 | 添付 | コミュニケーション

const dmStyles = {
  overlay: { position:'fixed', inset:0, background:'rgba(10,10,10,0.4)', backdropFilter:'blur(2px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:40, fontFamily:"'Zen Kaku Gothic New', sans-serif" },
  modal: { background:'#fff', borderRadius:16, width:'100%', maxWidth:980, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,0.25)' },
  header: { padding:'20px 28px 0', borderBottom:'1px solid #f0f0ee', display:'flex', flexDirection:'column', gap:14 },
  topRow: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14 },
  tabBar: { display:'flex', gap:0, marginTop:6 },
  tab: (active) => ({ padding:'10px 14px', fontSize:12, cursor:'pointer', fontFamily:"'Fraunces', serif", fontWeight:500, color: active ? '#0a0a0a' : '#888', borderBottom: active ? '2px solid #0a0a0a' : '2px solid transparent', marginBottom:-1 }),
  tabCount: { fontSize:9, color:'#bbb', marginLeft:4, fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' },
  body: { display:'flex', flex:1, minHeight:0 },
  main: { flex:1, padding:'20px 28px', overflowY:'auto', display:'flex', flexDirection:'column', gap:24 },
  side: { width:280, borderLeft:'1px solid #f0f0ee', padding:'20px 24px', overflowY:'auto', background:'#fafaf9', display:'flex', flexDirection:'column', gap:20 },
  fullPanel: { flex:1, padding:'20px 28px', overflowY:'auto' },
  footer: { padding:'12px 24px', borderTop:'1px solid #f0f0ee', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fafaf9' },
  label: { fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, fontWeight:500 },
  input: { width:'100%', border:'1px solid #e8e8e6', borderRadius:6, padding:'7px 10px', fontSize:13, fontFamily:'inherit', outline:'none', background:'#fff', color:'#0a0a0a' },
  inputNum: { fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', textAlign:'right' },
  field: { display:'flex', flexDirection:'column' },
  row: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
  section: { },
  sectionTitle: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:14, color:'#0a0a0a', marginBottom:12, display:'flex', alignItems:'center', gap:8 },
  variantTable: { width:'100%', fontSize:12, borderCollapse:'separate', borderSpacing:0 },
  vth: { padding:'6px 10px', fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em', textAlign:'left', borderBottom:'1px solid #e8e8e6', fontWeight:500 },
  vthNum: { textAlign:'right' },
  vtd: { padding:'8px 10px', fontSize:12, borderBottom:'1px solid #f5f5f4', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' },
  vtdMain: { background:'#f0fdf4' },
  closeBtn: { width:28, height:28, borderRadius:6, background:'transparent', border:'none', cursor:'pointer', color:'#888', fontSize:18, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' },

  // History timeline
  timeline: { position:'relative', paddingLeft:18 },
  timelineLine: { position:'absolute', left:6, top:6, bottom:6, width:1, background:'#e8e8e6' },
  timelineItem: { position:'relative', paddingBottom:18 },
  timelineDot: { position:'absolute', left:-18, top:4, width:13, height:13, borderRadius:'50%', border:'2px solid #fff', boxShadow:'0 0 0 1px #e8e8e6' },
  timelineHead: { display:'flex', alignItems:'baseline', gap:8, fontSize:12 },
  timelineMeta: { fontSize:10, color:'#888', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' },
  timelineBody: { fontSize:11, color:'#555', marginTop:3, lineHeight:1.6 },
  timelineDateGroup: { fontFamily:"'Fraunces', serif", fontSize:11, color:'#888', marginBottom:10, marginTop:14, paddingLeft:0 },

  // Attachments grid
  attachGrid: { display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10 },
  attachCard: { display:'flex', gap:11, padding:'10px 12px', border:'1px solid #f0f0ee', borderRadius:8, background:'#fff', cursor:'pointer', transition:'border-color 0.15s', alignItems:'center' },
  attachIcon: { width:36, height:44, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontFamily:"'Fraunces', serif", fontWeight:500, flexShrink:0, color:'#fff', letterSpacing:'0.02em' },
  attachInfo: { flex:1, minWidth:0 },
  attachName: { fontSize:12, color:'#0a0a0a', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  attachMeta: { fontSize:10, color:'#888', marginTop:2, fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' },
  attachDrop: { border:'1px dashed #d8d8d4', borderRadius:8, padding:'24px 14px', textAlign:'center', fontSize:12, color:'#888', cursor:'pointer', background:'#fafaf9', marginBottom:14 },

  // Comms
  msgList: { display:'flex', flexDirection:'column', gap:14 },
  msg: { display:'flex', gap:11 },
  msgAvatar: (color) => ({ width:30, height:30, borderRadius:'50%', background:color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontFamily:"'Fraunces', serif", fontWeight:500, flexShrink:0 }),
  msgBody: { flex:1, minWidth:0 },
  msgHead: { display:'flex', alignItems:'baseline', gap:8, marginBottom:4 },
  msgWho: { fontSize:12, fontWeight:500, color:'#0a0a0a' },
  msgChan: { fontSize:9, color:'#888', padding:'1px 6px', borderRadius:3, background:'#f5f5f4', fontFamily:'inherit' },
  msgWhen: { fontSize:10, color:'#bbb', marginLeft:'auto', fontFamily:"'Fraunces', serif" },
  msgText: { fontSize:12, color:'#0a0a0a', lineHeight:1.65, whiteSpace:'pre-wrap' },
  msgQuote: { borderLeft:'2px solid #e8e8e6', paddingLeft:10, color:'#888', fontSize:11, marginTop:6, fontStyle:'italic' },
  composer: { borderTop:'1px solid #f0f0ee', paddingTop:14, marginTop:14, display:'flex', flexDirection:'column', gap:8 },
  composerHead: { display:'flex', gap:8, alignItems:'center', fontSize:11 },
  composerSelect: { fontSize:11, padding:'4px 8px', border:'1px solid #e8e8e6', borderRadius:5, background:'#fff', fontFamily:'inherit', outline:'none' },
};

// File-type icons (color + ext label)
function fileIconStyle(ext) {
  const map = {
    pdf:  { bg:'#dc2626', label:'PDF' },
    zip:  { bg:'#7c3aed', label:'ZIP' },
    xlsx: { bg:'#15803d', label:'XLS' },
    xls:  { bg:'#15803d', label:'XLS' },
    docx: { bg:'#2563eb', label:'DOC' },
    doc:  { bg:'#2563eb', label:'DOC' },
    ai:   { bg:'#ea580c', label:'AI' },
    psd:  { bg:'#0891b2', label:'PSD' },
    png:  { bg:'#0891b2', label:'PNG' },
    jpg:  { bg:'#0891b2', label:'JPG' },
    jpeg: { bg:'#0891b2', label:'JPG' },
    eml:  { bg:'#888',    label:'EML' },
  };
  return map[ext.toLowerCase()] || { bg:'#888', label:ext.toUpperCase().slice(0,3) };
}

// === Mock data builders (deal-specific) ============================
function buildHistory(deal) {
  const sales = deal.sales;
  const cName = window.clientById(deal.client).name;
  const adopted = deal.variants.find(v => v.note === 'メイン') || deal.variants[0];
  return [
    { date: deal.updated, ts:'14:22', dot: window.STATUS[deal.status].dot, who:sales, kind:'status', title:`ステータスを「${window.STATUS[deal.status].label}」に変更`, body:'' },
    { date: deal.updated, ts:'10:08', dot:'#888', who:sales, kind:'edit', title:'メモを更新', body:deal.memo ? `「${deal.memo}」` : '内容なし' },
    { date: '2025-10-22', ts:'17:44', dot:'#888', who:sales, kind:'variant', title:`バリエーション「大量」を追加`, body:`${(adopted.qty * 1.5).toLocaleString()}個 / 単価 ${window.fmtUSDsmall(adopted.unit_usd * 0.85)}` },
    { date: '2025-10-22', ts:'11:30', dot:'#0891b2', who:sales, kind:'attach', title:'添付ファイルを2点追加', body:'仕様書_v3.pdf, サンプル写真_3点.zip' },
    { date: '2025-10-15', ts:'15:12', dot:'#888', who:sales, kind:'comm', title:`工場 ${deal.factory} から見積回答`, body:'単価USD・MOQ・リードタイムの3項目を確認' },
    { date: '2025-10-15', ts:'09:00', dot:'#888', who:sales, kind:'comm', title:`${cName} へ進捗共有メール送信`, body:'2案で再提示' },
    { date: '2025-10-12', ts:'13:50', dot:'#888', who:sales, kind:'edit', title:'希望納期を更新', body:`未定 → ${window.fmtDate(deal.delivery)}` },
    { date: '2025-10-10', ts:'10:00', dot:'#0a0a0a', who:sales, kind:'create', title:'案件作成', body:`${cName} からの相談を起票` },
  ];
}

const HIST_KIND_LABEL = {
  status: 'ステータス変更',
  edit: '編集',
  variant: 'バリエーション',
  attach: '添付',
  comm: 'コミュニケーション',
  create: '作成',
};

// Status progression: which steps are reached
const STATUS_FLOW = ['hearing','quote','proposal','order','production','shipped','delivered'];
function buildStatusProgress(deal) {
  const idx = STATUS_FLOW.indexOf(deal.status);
  return STATUS_FLOW.map((s, i) => ({
    key: s,
    label: window.STATUS[s].label,
    dot: window.STATUS[s].dot,
    state: i < idx ? 'done' : i === idx ? 'active' : 'pending',
    date: i === idx ? deal.updated : (i < idx ? `2025-10-${String(10 + i*2).padStart(2,'0')}` : null),
  }));
}

function buildAttachments(deal) {
  return [
    { id:'a1', name:'仕様書_v3.pdf', size:'2.4 MB', date:'2025-10-22', who:deal.sales, ext:'pdf', cat:'spec', versions:3, thumb:'doc' },
    { id:'a2', name:'サンプル写真_3点.zip', size:'18.2 MB', date:'2025-10-22', who:deal.sales, ext:'zip', cat:'photo', versions:1, thumb:'photos' },
    { id:'a3', name:'入稿データ_AI.ai', size:'4.7 MB', date:'2025-10-18', who:deal.sales, ext:'ai', cat:'spec', versions:2, thumb:'design' },
    { id:'a4', name:'価格比較_工場3社.xlsx', size:'128 KB', date:'2025-10-15', who:deal.sales, ext:'xlsx', cat:'quote', versions:1, thumb:'sheet' },
    { id:'a5', name:`${deal.factory.split(' ')[0]}_quotation_v2.pdf`, size:'612 KB', date:'2025-10-15', who:deal.factory.split(' ')[0], ext:'pdf', cat:'quote', versions:2, thumb:'doc' },
    { id:'a6', name:'NDA署名済み.pdf', size:'1.1 MB', date:'2025-10-11', who:deal.sales, ext:'pdf', cat:'contract', versions:1, thumb:'doc' },
    { id:'a7', name:'初回相談メール.eml', size:'42 KB', date:'2025-10-10', who:deal.sales, ext:'eml', cat:'other', versions:1, thumb:'mail' },
  ];
}

const ATTACH_CATS = {
  spec:     { label:'仕様書 / 入稿', color:'#2563eb' },
  quote:    { label:'見積',          color:'#15803d' },
  photo:    { label:'写真 / サンプル', color:'#0891b2' },
  contract: { label:'契約',          color:'#7c3aed' },
  other:    { label:'その他',         color:'#888' },
};

function buildComms(deal) {
  const cName = window.clientById(deal.client).name;
  return [
    { id:'m1', who:deal.sales, role:'BAOFlow', side:'internal', channel:'内部メモ', when:'2 時間前', date:'2025-10-25', text:`${deal.factory} から見積再提示の連絡が来た。MOQ 1500個でも価格据え置きOKとのこと。次回打合せで提案する。`, color:'#0a0a0a', unread:false, hasFollowup:true, followupDate:'2025-10-28' },
    { id:'m2', who:'佐藤 (' + cName + ')', role:'クライアント', side:'client', channel:'メール', when:'昨日', date:'2025-10-24', text:`お世話になっております。\n${deal.name} の件、社内承認が下りましたので進めてください。納期は当初通りでお願いします。`, color:'#2563eb', quote:'BAOFlow より「再見積（小ロット版）」のご提案について', unread:true, hasFollowup:false },
    { id:'m3', who:deal.factory.split(' ')[0] + ' / 王', role:'工場', side:'factory', channel:'WeChat', when:'10/22', date:'2025-10-22', text:`你好、${deal.name}的样品已发出。请查收。\nMOQ 1000pcs 也OK，但单价 +12% になります。`, color:'#15803d', unread:false, hasFollowup:false },
    { id:'m4', who:deal.sales, role:'BAOFlow', side:'internal', channel:'内部メモ', when:'10/15', date:'2025-10-15', text:`先方から「もう少し安くならないか」の相談あり。掛け率55%維持しつつ、数量2倍プランを提案するのが妥当。`, color:'#0a0a0a', unread:false, hasFollowup:false },
    { id:'m5', who:'佐藤 (' + cName + ')', role:'クライアント', side:'client', channel:'電話', when:'10/12', date:'2025-10-12', text:`(電話メモ) 仕様の最終確認・希望納期の確認。\n - 仕様: 当初提示通りでOK\n - 納期: ${window.fmtDate(deal.delivery)} までに納品希望`, color:'#2563eb', unread:false, hasFollowup:false },
  ];
}

const COMM_FILTERS = [
  { key:'all',      label:'すべて',       sides:['internal','client','factory'] },
  { key:'client',   label:'クライアント',  sides:['client'] },
  { key:'factory',  label:'工場',          sides:['factory'] },
  { key:'internal', label:'内部メモ',      sides:['internal'] },
];

const CHANNEL_ICONS = {
  '内部メモ': '📝',
  'メール': '✉',
  'WeChat': '💬',
  '電話': '📞',
  '打合せ': '🤝',
};

// === Tabs ===========================================================
function HistoryTab({ deal }) {
  const allItems = buildHistory(deal);
  const [filter, setFilter] = React.useState('all');
  const items = filter === 'all' ? allItems : allItems.filter(x => x.kind === filter);
  const counts = allItems.reduce((acc, x) => { acc[x.kind] = (acc[x.kind] || 0) + 1; return acc; }, {});
  const progress = buildStatusProgress(deal);
  // group by date
  const byDate = items.reduce((acc, x) => { (acc[x.date] = acc[x.date] || []).push(x); return acc; }, {});
  const dates = Object.keys(byDate).sort((a,b) => b.localeCompare(a));

  const filterChip = (key, label, count) => (
    <span key={key} onClick={() => setFilter(key)} style={{
      padding:'4px 10px', borderRadius:9999, fontSize:10, cursor:'pointer',
      background: filter === key ? '#0a0a0a' : '#f5f5f4',
      color: filter === key ? '#fff' : '#555',
      transition:'all 0.12s',
      display:'inline-flex', alignItems:'center', gap:5,
    }}>
      {label}{count != null && <span style={{ opacity:0.6, fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{count}</span>}
    </span>
  );

  return (
    <div>
      {/* Status progression visual */}
      <div style={{ marginBottom:22, padding:'14px 16px', background:'#fafaf9', borderRadius:8, border:'1px solid #f0f0ee' }}>
        <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12, fontWeight:500 }}>ステータス進行</div>
        <div style={{ display:'flex', alignItems:'center', gap:0 }}>
          {progress.map((s, i) => (
            <React.Fragment key={s.key}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, flex:'0 0 auto', minWidth:78 }}>
                <div style={{
                  width: s.state === 'active' ? 22 : 16, height: s.state === 'active' ? 22 : 16,
                  borderRadius:'50%',
                  background: s.state === 'pending' ? '#fff' : s.dot,
                  border: s.state === 'pending' ? '1.5px dashed #d8d8d4' : (s.state === 'active' ? `3px solid ${s.dot}` : 'none'),
                  boxShadow: s.state === 'active' ? `0 0 0 4px ${s.dot}22` : 'none',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  transition:'all 0.2s',
                }}>
                  {s.state === 'done' && <span style={{ color:'#fff', fontSize:9, lineHeight:1 }}>✓</span>}
                  {s.state === 'active' && <span style={{ width:8, height:8, borderRadius:'50%', background:'#fff' }}></span>}
                </div>
                <span style={{
                  fontSize:10, fontWeight: s.state === 'active' ? 600 : 400,
                  color: s.state === 'pending' ? '#bbb' : '#0a0a0a',
                  whiteSpace:'nowrap',
                }}>{s.label}</span>
                <span style={{ fontSize:9, color:'#bbb', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', minHeight:11 }}>
                  {s.date ? window.fmtDate(s.date).slice(5) : ''}
                </span>
              </div>
              {i < progress.length - 1 && (
                <div style={{
                  flex:1, height:1, marginTop:-22,
                  background: progress[i+1].state === 'pending'
                    ? 'repeating-linear-gradient(90deg, #d8d8d4 0 4px, transparent 4px 8px)'
                    : '#0a0a0a',
                  opacity: s.state === 'pending' ? 0.4 : 0.7,
                }}></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, gap:10, flexWrap:'wrap' }}>
        <div style={dmStyles.sectionTitle}>履歴タイムライン<span style={{ fontSize:10, color:'#888', fontWeight:400 }}>{items.length} / {allItems.length} 件</span></div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {filterChip('all', 'すべて', allItems.length)}
          {filterChip('status', 'ステータス', counts.status)}
          {filterChip('edit', '編集', counts.edit)}
          {filterChip('variant', 'バリエーション', counts.variant)}
          {filterChip('attach', '添付', counts.attach)}
          {filterChip('comm', '通信', counts.comm)}
        </div>
      </div>

      {dates.length === 0 ? (
        <div style={{ padding:'40px 20px', textAlign:'center', color:'#bbb', fontSize:12 }}>該当する履歴がありません</div>
      ) : dates.map(d => (
        <div key={d}>
          <div style={dmStyles.timelineDateGroup}>{window.fmtDate(d)} ({['日','月','火','水','木','金','土'][new Date(d).getDay()]})</div>
          <div style={dmStyles.timeline}>
            <div style={dmStyles.timelineLine}></div>
            {byDate[d].map((h, i) => (
              <div key={i} style={dmStyles.timelineItem}>
                <span style={{ ...dmStyles.timelineDot, background:h.dot }}></span>
                <div style={dmStyles.timelineHead}>
                  <span style={{ fontWeight:500 }}>{h.title}</span>
                  <span style={{ fontSize:9, color:'#bbb', padding:'1px 6px', borderRadius:3, background:'#f5f5f4' }}>{HIST_KIND_LABEL[h.kind]}</span>
                  <span style={dmStyles.timelineMeta}>{h.ts} · {h.who}</span>
                </div>
                {h.body && <div style={dmStyles.timelineBody}>{h.body}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AttachThumb({ thumb, ext }) {
  const icon = fileIconStyle(ext);
  // Visual stand-in based on thumb kind
  if (thumb === 'photos') {
    return (
      <div style={{ width:56, height:56, borderRadius:6, position:'relative', flexShrink:0, background:'#f0f0ee', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', gap:1.5, padding:1.5 }}>
          <div style={{ background:'#9ca3af' }}></div>
          <div style={{ background:'#6b7280' }}></div>
          <div style={{ background:'#d1d5db' }}></div>
          <div style={{ background:'#4b5563' }}></div>
        </div>
        <div style={{ position:'absolute', bottom:2, right:2, fontSize:8, color:'#fff', background:'rgba(0,0,0,0.6)', padding:'1px 4px', borderRadius:2, fontFamily:"'Fraunces', serif" }}>+3</div>
      </div>
    );
  }
  if (thumb === 'doc') {
    return (
      <div style={{ width:56, height:56, borderRadius:6, flexShrink:0, background:'#fff', border:'1px solid #e8e8e6', position:'relative', overflow:'hidden', padding:'6px 5px' }}>
        <div style={{ height:1.5, background:'#0a0a0a', marginBottom:3, width:'70%' }}></div>
        <div style={{ height:1, background:'#bbb', marginBottom:2 }}></div>
        <div style={{ height:1, background:'#bbb', marginBottom:2 }}></div>
        <div style={{ height:1, background:'#bbb', marginBottom:2, width:'80%' }}></div>
        <div style={{ height:1, background:'#bbb', marginBottom:2 }}></div>
        <div style={{ height:1, background:'#bbb', marginBottom:2, width:'60%' }}></div>
        <div style={{ position:'absolute', bottom:3, right:3, fontSize:7, color:'#fff', background:icon.bg, padding:'1px 3px', borderRadius:2, fontFamily:"'Fraunces', serif", fontWeight:600 }}>{icon.label}</div>
      </div>
    );
  }
  if (thumb === 'sheet') {
    return (
      <div style={{ width:56, height:56, borderRadius:6, flexShrink:0, background:'#fff', border:'1px solid #e8e8e6', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gridTemplateRows:'repeat(5, 1fr)', gap:0 }}>
          {Array.from({ length:20 }).map((_, i) => (
            <div key={i} style={{ borderRight:'0.5px solid #e8e8e6', borderBottom:'0.5px solid #e8e8e6', background: i < 4 ? '#15803d22' : 'transparent' }}></div>
          ))}
        </div>
        <div style={{ position:'absolute', bottom:3, right:3, fontSize:7, color:'#fff', background:icon.bg, padding:'1px 3px', borderRadius:2, fontFamily:"'Fraunces', serif", fontWeight:600 }}>{icon.label}</div>
      </div>
    );
  }
  if (thumb === 'design') {
    return (
      <div style={{ width:56, height:56, borderRadius:6, flexShrink:0, background:'#1a1a1a', position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:28, height:28, background:'linear-gradient(135deg, #ea580c 0%, #fbbf24 100%)', borderRadius:'50% 50% 50% 0', transform:'rotate(45deg)' }}></div>
        <div style={{ position:'absolute', bottom:3, right:3, fontSize:7, color:'#fff', background:icon.bg, padding:'1px 3px', borderRadius:2, fontFamily:"'Fraunces', serif", fontWeight:600 }}>{icon.label}</div>
      </div>
    );
  }
  if (thumb === 'mail') {
    return (
      <div style={{ width:56, height:56, borderRadius:6, flexShrink:0, background:'#fafaf9', border:'1px solid #e8e8e6', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#888' }}>
        ✉
        <div style={{ position:'absolute', bottom:3, right:3, fontSize:7, color:'#fff', background:icon.bg, padding:'1px 3px', borderRadius:2, fontFamily:"'Fraunces', serif", fontWeight:600 }}>{icon.label}</div>
      </div>
    );
  }
  // generic
  return <div style={{ ...dmStyles.attachIcon, width:56, height:56, fontSize:13, background:icon.bg }}>{icon.label}</div>;
}

function AttachmentsTab({ deal }) {
  const allFiles = buildAttachments(deal);
  const [cat, setCat] = React.useState('all');
  const files = cat === 'all' ? allFiles : allFiles.filter(f => f.cat === cat);
  const counts = allFiles.reduce((acc, f) => { acc[f.cat] = (acc[f.cat] || 0) + 1; return acc; }, {});

  // Group by category when showing all
  const grouped = cat === 'all'
    ? Object.keys(ATTACH_CATS).map(k => ({ cat:k, items: allFiles.filter(f => f.cat === k) })).filter(g => g.items.length > 0)
    : [{ cat, items: files }];

  const filterChip = (key, label, count, color) => (
    <span key={key} onClick={() => setCat(key)} style={{
      padding:'4px 10px', borderRadius:9999, fontSize:10, cursor:'pointer',
      background: cat === key ? '#0a0a0a' : '#f5f5f4',
      color: cat === key ? '#fff' : '#555',
      display:'inline-flex', alignItems:'center', gap:5, transition:'all 0.12s',
    }}>
      {color && <span style={{ width:7, height:7, borderRadius:'50%', background: cat === key ? '#fff' : color }}></span>}
      {label}{count != null && <span style={{ opacity:0.6, fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{count}</span>}
    </span>
  );

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:10, flexWrap:'wrap' }}>
        <div style={dmStyles.sectionTitle}>添付ファイル<span style={{ fontSize:10, color:'#888', fontWeight:400 }}>{files.length} / {allFiles.length} 件 · 合計 27 MB</span></div>
        <button style={{ background:'#0a0a0a', color:'#fff', border:'none', borderRadius:6, padding:'5px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>+ アップロード</button>
      </div>

      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:14 }}>
        {filterChip('all', 'すべて', allFiles.length)}
        {Object.entries(ATTACH_CATS).map(([k, v]) => filterChip(k, v.label, counts[k], v.color))}
      </div>

      <div style={dmStyles.attachDrop}>
        ↑ ドラッグ&ドロップ、または上のボタンからファイルを追加
      </div>

      {grouped.map(g => (
        <div key={g.cat} style={{ marginBottom:18 }}>
          {cat === 'all' && (
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8, fontSize:11 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:ATTACH_CATS[g.cat].color }}></span>
              <span style={{ fontWeight:500, color:'#0a0a0a' }}>{ATTACH_CATS[g.cat].label}</span>
              <span style={{ color:'#bbb', fontSize:10, fontFamily:"'Fraunces', serif" }}>{g.items.length}</span>
            </div>
          )}
          <div style={dmStyles.attachGrid}>
            {g.items.map(f => (
              <div key={f.id} style={dmStyles.attachCard} onMouseEnter={e => e.currentTarget.style.borderColor='#0a0a0a'} onMouseLeave={e => e.currentTarget.style.borderColor='#f0f0ee'}>
                <AttachThumb thumb={f.thumb} ext={f.ext} />
                <div style={dmStyles.attachInfo}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ ...dmStyles.attachName, flex:1 }}>{f.name}</span>
                    {f.versions > 1 && (
                      <span style={{ fontSize:9, color:'#888', padding:'1px 5px', borderRadius:3, background:'#f5f5f4', fontFamily:"'Fraunces', serif", whiteSpace:'nowrap' }}>v{f.versions}</span>
                    )}
                  </div>
                  <div style={dmStyles.attachMeta}>{f.size} · {window.fmtDate(f.date)} · {f.who}</div>
                  <div style={{ display:'flex', gap:8, marginTop:4, fontSize:10 }}>
                    <span style={{ color:'#0a0a0a', cursor:'pointer', borderBottom:'1px dotted #0a0a0a' }}>プレビュー</span>
                    <span style={{ color:'#0a0a0a', cursor:'pointer', borderBottom:'1px dotted #0a0a0a' }}>DL</span>
                    {f.versions > 1 && <span style={{ color:'#888', cursor:'pointer', borderBottom:'1px dotted #888' }}>履歴</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CommsTab({ deal }) {
  const allMsgs = buildComms(deal);
  const [filter, setFilter] = React.useState('all');
  const [channel, setChannel] = React.useState('内部メモ');
  const [composerText, setComposerText] = React.useState('');
  const filterDef = COMM_FILTERS.find(f => f.key === filter);
  const msgs = allMsgs.filter(m => filterDef.sides.includes(m.side));
  const counts = allMsgs.reduce((acc, m) => { acc[m.side] = (acc[m.side] || 0) + 1; return acc; }, {});
  const unreadCount = allMsgs.filter(m => m.unread).length;
  const followups = allMsgs.filter(m => m.hasFollowup);

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, gap:10, flexWrap:'wrap' }}>
        <div style={dmStyles.sectionTitle}>
          コミュニケーション履歴<span style={{ fontSize:10, color:'#888', fontWeight:400 }}>{msgs.length} / {allMsgs.length} 件</span>
          {unreadCount > 0 && <span style={{ fontSize:10, color:'#fff', background:'#dc2626', padding:'1px 7px', borderRadius:9999, fontWeight:500 }}>未読 {unreadCount}</span>}
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {COMM_FILTERS.map(f => {
            const c = f.key === 'all' ? allMsgs.length : (counts[f.sides[0]] || 0);
            return (
              <span key={f.key} onClick={() => setFilter(f.key)} style={{
                padding:'4px 10px', borderRadius:9999, fontSize:10, cursor:'pointer',
                background: filter === f.key ? '#0a0a0a' : '#f5f5f4',
                color: filter === f.key ? '#fff' : '#555',
                display:'inline-flex', alignItems:'center', gap:5, transition:'all 0.12s',
              }}>
                {f.label}<span style={{ opacity:0.6, fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{c}</span>
              </span>
            );
          })}
        </div>
      </div>

      {followups.length > 0 && filter === 'all' && (
        <div style={{ background:'#fefce8', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:11, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:13 }}>⏰</span>
          <span style={{ color:'#92400e', flex:1 }}>
            <strong style={{ fontWeight:600 }}>フォローアップ予定:</strong> {followups.length}件のリマインダー設定中（最も近い予定 {window.fmtDate(followups[0].followupDate)}）
          </span>
          <span style={{ color:'#92400e', cursor:'pointer', borderBottom:'1px dotted #92400e' }}>確認</span>
        </div>
      )}

      <div style={dmStyles.msgList}>
        {msgs.length === 0 ? (
          <div style={{ padding:'40px 20px', textAlign:'center', color:'#bbb', fontSize:12 }}>該当するメッセージがありません</div>
        ) : msgs.map(m => (
          <div key={m.id} style={{ ...dmStyles.msg, padding: m.unread ? '8px 10px' : 0, background: m.unread ? '#fffbeb' : 'transparent', borderRadius: m.unread ? 8 : 0, borderLeft: m.unread ? '2px solid #e5a32e' : 'none' }}>
            <div style={dmStyles.msgAvatar(m.color)}>{m.who.slice(0,1)}</div>
            <div style={dmStyles.msgBody}>
              <div style={dmStyles.msgHead}>
                <span style={dmStyles.msgWho}>{m.who}</span>
                <span style={dmStyles.msgChan}>{CHANNEL_ICONS[m.channel] || ''} {m.channel}</span>
                <span style={{ fontSize:10, color:'#bbb' }}>· {m.role}</span>
                {m.unread && <span style={{ fontSize:9, color:'#fff', background:'#dc2626', padding:'1px 6px', borderRadius:9999, fontWeight:500 }}>未読</span>}
                {m.hasFollowup && <span style={{ fontSize:9, color:'#92400e', background:'#fefce8', padding:'1px 6px', borderRadius:9999, border:'1px solid #fde68a' }}>⏰ {window.fmtDate(m.followupDate).slice(5)}</span>}
                <span style={dmStyles.msgWhen}>{m.when}</span>
              </div>
              {m.quote && <div style={dmStyles.msgQuote}>{m.quote}</div>}
              <div style={dmStyles.msgText}>{m.text}</div>
              <div style={{ display:'flex', gap:10, marginTop:6, fontSize:10 }}>
                <span style={{ color:'#0a0a0a', cursor:'pointer', borderBottom:'1px dotted #0a0a0a' }}>↩ 返信</span>
                <span style={{ color:'#888', cursor:'pointer', borderBottom:'1px dotted #888' }}>引用</span>
                <span style={{ color:'#888', cursor:'pointer', borderBottom:'1px dotted #888' }}>⏰ リマインド設定</span>
                {m.unread && <span style={{ color:'#15803d', cursor:'pointer', borderBottom:'1px dotted #15803d' }}>既読にする</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={dmStyles.composer}>
        <div style={dmStyles.composerHead}>
          <span style={{ color:'#888' }}>記録する:</span>
          <select style={dmStyles.composerSelect} value={channel} onChange={e => setChannel(e.target.value)}>
            <option>内部メモ</option>
            <option>メール送受信</option>
            <option>電話メモ</option>
            <option>WeChat / チャット</option>
            <option>打合せメモ</option>
          </select>
          <label style={{ display:'inline-flex', alignItems:'center', gap:4, color:'#888', cursor:'pointer' }}>
            <input type="checkbox" style={{ accentColor:'#0a0a0a' }} /> リマインダー
          </label>
          <span style={{ color:'#bbb', fontSize:10, marginLeft:'auto' }}>· タイムラインに自動追加</span>
        </div>
        <textarea value={composerText} onChange={e => setComposerText(e.target.value)} placeholder="やりとりの内容を記録..." style={{ ...dmStyles.input, minHeight:60, resize:'vertical', fontFamily:'inherit' }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:10, color:'#bbb' }}>{composerText.length} 文字</span>
          <div style={{ display:'flex', gap:6 }}>
            <button style={{ background:'transparent', color:'#888', border:'none', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>📎 ファイル添付</button>
            <button disabled={!composerText} style={{ background: composerText ? '#0a0a0a' : '#e8e8e6', color:'#fff', border:'none', borderRadius:6, padding:'5px 14px', fontSize:11, cursor: composerText ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>記録</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailsTab({ deal, client }) {
  return (
    <>
      <div style={dmStyles.section}>
        <div style={dmStyles.sectionTitle}>仕様</div>
        <div style={dmStyles.field}>
          <textarea defaultValue={deal.spec} style={{ ...dmStyles.input, minHeight:60, resize:'vertical', fontFamily:'inherit' }} />
        </div>
      </div>

      <div style={dmStyles.section}>
        <div style={dmStyles.sectionTitle}>
          <span>数量・価格バリエーション</span>
          <span style={{ fontSize:10, color:'#888', fontWeight:400 }}>{deal.variants.length} 案</span>
          <button style={{ marginLeft:'auto', background:'transparent', border:'1px dashed #d8d8d4', borderRadius:5, padding:'3px 9px', fontSize:11, cursor:'pointer', color:'#555', fontFamily:'inherit' }}>+ 追加</button>
        </div>
        <table style={dmStyles.variantTable}>
          <thead>
            <tr>
              <th style={dmStyles.vth}>ラベル</th>
              <th style={{ ...dmStyles.vth, ...dmStyles.vthNum }}>数量</th>
              <th style={{ ...dmStyles.vth, ...dmStyles.vthNum }}>単価USD</th>
              <th style={{ ...dmStyles.vth, ...dmStyles.vthNum }}>合計JPY</th>
              <th style={{ ...dmStyles.vth, ...dmStyles.vthNum }}>粗利</th>
              <th style={dmStyles.vth}>採用</th>
            </tr>
          </thead>
          <tbody>
            {deal.variants.map((v, i) => {
              const isMain = v.note === 'メイン';
              const bg = isMain ? dmStyles.vtdMain : {};
              return (
                <tr key={i}>
                  <td style={{ ...dmStyles.vtd, ...bg, fontFamily:'inherit', fontStyle:'italic', color:'#555' }}>{v.note}</td>
                  <td style={{ ...dmStyles.vtd, ...bg, textAlign:'right' }}>{v.qty.toLocaleString()}</td>
                  <td style={{ ...dmStyles.vtd, ...bg, textAlign:'right' }}>{window.fmtUSDsmall(v.unit_usd)}</td>
                  <td style={{ ...dmStyles.vtd, ...bg, textAlign:'right', fontWeight: isMain ? 600 : 400 }}>{window.fmtJPY(v.total_jpy)}</td>
                  <td style={{ ...dmStyles.vtd, ...bg, textAlign:'right', color: v.profit_pct >= 35 ? '#15803d' : v.profit_pct >= 25 ? '#0a0a0a' : '#e5a32e' }}>{v.profit_pct.toFixed(1)}%</td>
                  <td style={{ ...dmStyles.vtd, ...bg, fontFamily:'inherit' }}>
                    {isMain ? <span style={{ color:'#15803d', fontSize:11 }}>● 採用中</span> : <button style={{ background:'transparent', border:'1px solid #e8e8e6', borderRadius:4, padding:'2px 8px', fontSize:10, cursor:'pointer', color:'#555', fontFamily:'inherit' }}>採用</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={dmStyles.section}>
        <div style={dmStyles.sectionTitle}>メモ</div>
        <textarea defaultValue={deal.memo} placeholder="自由記述（社内共有）" style={{ ...dmStyles.input, minHeight:80, resize:'vertical', fontFamily:'inherit' }} />
      </div>
    </>
  );
}

// === Main modal =====================================================
function DealDetailModal({ deal, onClose }) {
  if (!deal) return null;
  const [tab, setTab] = React.useState('details');
  const [docModal, setDocModal] = React.useState(null);
  const client = window.clientById(deal.client);
  const histCount = buildHistory(deal).length;
  const attachCount = buildAttachments(deal).length;
  const commCount = buildComms(deal).length;

  return (
    <div style={dmStyles.overlay} onClick={onClose}>
      <div style={dmStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={dmStyles.header}>
          <div style={dmStyles.topRow}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ fontFamily:"'Fraunces', serif", color:'#888', fontSize:11, fontVariantNumeric:'tabular-nums' }}>{deal.id}</span>
                <span style={{ color:'#bbb' }}>·</span>
                <span style={{ fontSize:11, color:'#555' }}>{client.name}</span>
                <window.StatusPill status={deal.status} />
                {window.isUrgent(deal) && <span style={{ fontSize:10, color:'#e5a32e', display:'inline-flex', alignItems:'center', gap:3 }}>● 納期 {window.daysUntil(deal.delivery)}日</span>}
              </div>
              <input defaultValue={deal.name} style={{ ...dmStyles.input, fontSize:20, fontWeight:600, padding:'4px 0', border:'none', fontFamily:"'Fraunces', serif" }} />
            </div>
            <button style={dmStyles.closeBtn} onClick={onClose} onMouseEnter={e => e.currentTarget.style.background='#f5f5f4'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>×</button>
          </div>
          <div style={dmStyles.tabBar}>
            <div style={dmStyles.tab(tab === 'details')} onClick={() => setTab('details')}>詳細</div>
            <div style={dmStyles.tab(tab === 'history')} onClick={() => setTab('history')}>履歴<span style={dmStyles.tabCount}>{histCount}</span></div>
            <div style={dmStyles.tab(tab === 'attachments')} onClick={() => setTab('attachments')}>添付<span style={dmStyles.tabCount}>{attachCount}</span></div>
            <div style={dmStyles.tab(tab === 'comms')} onClick={() => setTab('comms')}>コミュニケーション<span style={dmStyles.tabCount}>{commCount}</span></div>
          </div>
        </div>

        <div style={dmStyles.body}>
          {tab === 'details' && (
            <>
              <div style={dmStyles.main}>
                <DetailsTab deal={deal} client={client} />
              </div>
              <div style={dmStyles.side}>
                <div>
                  <div style={dmStyles.label}>クライアント</div>
                  <div style={{ fontSize:13, color:'#0a0a0a' }}>{client.name}</div>
                </div>
                <div style={dmStyles.row}>
                  <div style={dmStyles.field}>
                    <div style={dmStyles.label}>希望納期</div>
                    <input type="date" defaultValue={deal.delivery} style={{ ...dmStyles.input, fontFamily:"'Fraunces', serif" }} />
                  </div>
                  <div style={dmStyles.field}>
                    <div style={dmStyles.label}>担当</div>
                    <select defaultValue={deal.sales} style={dmStyles.input}>
                      {window.SALES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={dmStyles.field}>
                  <div style={dmStyles.label}>工場</div>
                  <select defaultValue={deal.factory} style={dmStyles.input}>
                    {window.FACTORIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div style={dmStyles.row}>
                  <div style={dmStyles.field}>
                    <div style={dmStyles.label}>FX (JPY/USD)</div>
                    <input defaultValue="155" style={{ ...dmStyles.input, ...dmStyles.inputNum }} />
                  </div>
                  <div style={dmStyles.field}>
                    <div style={dmStyles.label}>掛け率</div>
                    <input defaultValue="55%" style={{ ...dmStyles.input, ...dmStyles.inputNum }} />
                  </div>
                </div>
                <div style={dmStyles.field}>
                  <div style={dmStyles.label}>Ver</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontFamily:"'Fraunces', serif", fontSize:13 }}>{deal.version}</span>
                    <button onClick={() => setTab('history')} style={{ background:'transparent', border:'1px solid #e8e8e6', borderRadius:4, padding:'2px 7px', fontSize:10, cursor:'pointer', color:'#555', fontFamily:'inherit' }}>履歴を見る</button>
                  </div>
                </div>
              </div>
            </>
          )}
          {tab === 'history' && <div style={dmStyles.fullPanel}><HistoryTab deal={deal} /></div>}
          {tab === 'attachments' && <div style={dmStyles.fullPanel}><AttachmentsTab deal={deal} /></div>}
          {tab === 'comms' && <div style={dmStyles.fullPanel}><CommsTab deal={deal} /></div>}
        </div>

        <div style={dmStyles.footer}>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setDocModal('po')} style={{ background:'#fff', color:'#555', border:'1px solid #e8e8e6', borderRadius:6, padding:'6px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>📄 見積依頼書を生成</button>
            <button onClick={() => setDocModal('invoice')} style={{ background:'#fff', color:'#555', border:'1px solid #e8e8e6', borderRadius:6, padding:'6px 12px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>💴 請求書を生成</button>
            <button style={{ background:'transparent', color:'#dc2626', border:'none', padding:'6px 8px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>削除</button>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:10, color:'#bbb' }}>最終更新 {window.fmtDate(deal.updated)}</span>
            <button onClick={onClose} style={{ background:'transparent', color:'#555', border:'1px solid #e8e8e6', borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>キャンセル</button>
            <button style={{ background:'#0a0a0a', color:'#fff', border:'none', borderRadius:6, padding:'6px 16px', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>保存</button>
          </div>
        </div>
      </div>
      {docModal && <window.DocGeneratorModal deal={deal} type={docModal} onClose={() => setDocModal(null)} />}
    </div>
  );
}

window.DealDetailModal = DealDetailModal;

// === Inline pane variant (for split layouts) =========================
// Same content as the modal, but rendered inline (no overlay/centering).
// Use when you want a persistent right-pane like an email UI.
const dpStyles = {
  pane: { background:'#fff', borderRadius:14, border:'1px solid rgba(0,0,0,0.06)', display:'flex', flexDirection:'column', overflow:'hidden', height:'100%', fontFamily:"'Zen Kaku Gothic New', sans-serif" },
  empty: { display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', height:'100%', color:'#bbb', fontSize:13, gap:10, padding:30, textAlign:'center' },
  emptyIcon: { width:48, height:48, borderRadius:'50%', background:'#fafaf9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:'#d8d8d4' },
  paneHeader: { padding:'14px 18px 0', borderBottom:'1px solid #f0f0ee', display:'flex', flexDirection:'column', gap:10 },
  paneBody: { display:'flex', flex:1, minHeight:0 },
  paneMain: { flex:1, padding:'16px 20px', overflowY:'auto', display:'flex', flexDirection:'column', gap:18 },
  paneSide: { width:230, borderLeft:'1px solid #f0f0ee', padding:'16px 18px', overflowY:'auto', background:'#fafaf9', display:'flex', flexDirection:'column', gap:14 },
  paneFull: { flex:1, padding:'16px 20px', overflowY:'auto' },
  paneFooter: { padding:'10px 16px', borderTop:'1px solid #f0f0ee', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fafaf9', gap:8, flexWrap:'wrap' },
};

function DealDetailPane({ deal, onClose }) {
  const [tab, setTab] = React.useState('details');
  const [docModal, setDocModal] = React.useState(null);
  if (!deal) {
    return (
      <div style={dpStyles.pane}>
        <div style={dpStyles.empty}>
          <div style={dpStyles.emptyIcon}>📋</div>
          <div>案件を選択すると<br/>詳細がここに表示されます</div>
        </div>
      </div>
    );
  }
  const client = window.clientById(deal.client);
  const histCount = buildHistory(deal).length;
  const attachCount = buildAttachments(deal).length;
  const commCount = buildComms(deal).length;
  return (
    <div style={dpStyles.pane}>
      <div style={dpStyles.paneHeader}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
              <span style={{ fontFamily:"'Fraunces', serif", color:'#888', fontSize:10, fontVariantNumeric:'tabular-nums' }}>{deal.id}</span>
              <span style={{ color:'#bbb' }}>·</span>
              <span style={{ fontSize:10, color:'#555' }}>{client.name}</span>
              <window.StatusPill status={deal.status} />
              {window.isUrgent(deal) && <span style={{ fontSize:9, color:'#e5a32e' }}>● 納期 {window.daysUntil(deal.delivery)}日</span>}
            </div>
            <input defaultValue={deal.name} key={deal.id} style={{ width:'100%', fontSize:17, fontWeight:600, padding:'2px 0', border:'none', fontFamily:"'Fraunces', serif", outline:'none', background:'transparent', color:'#0a0a0a' }} />
          </div>
          {onClose && (
            <button onClick={onClose} style={{ width:24, height:24, borderRadius:5, background:'transparent', border:'none', cursor:'pointer', color:'#888', fontSize:16, lineHeight:1 }} onMouseEnter={e => e.currentTarget.style.background='#f5f5f4'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>×</button>
          )}
        </div>
        <div style={{ display:'flex', gap:0 }}>
          {[['details','詳細', null], ['history', '履歴', histCount], ['attachments', '添付', attachCount], ['comms', '通信', commCount]].map(([k, l, c]) => (
            <div key={k} onClick={() => setTab(k)} style={{ padding:'8px 12px', fontSize:11, cursor:'pointer', fontFamily:"'Fraunces', serif", fontWeight:500, color: tab === k ? '#0a0a0a' : '#888', borderBottom: tab === k ? '2px solid #0a0a0a' : '2px solid transparent', marginBottom:-1, display:'inline-flex', alignItems:'center', gap:4 }}>
              {l}{c != null && <span style={{ fontSize:9, color:'#bbb', fontVariantNumeric:'tabular-nums' }}>{c}</span>}
            </div>
          ))}
        </div>
      </div>
      <div style={dpStyles.paneBody}>
        {tab === 'details' && (
          <>
            <div style={dpStyles.paneMain}>
              <DetailsTab deal={deal} client={client} />
            </div>
            <div style={dpStyles.paneSide}>
              <div>
                <div style={dmStyles.label}>クライアント</div>
                <div style={{ fontSize:12, color:'#0a0a0a' }}>{client.name}</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={dmStyles.field}>
                  <div style={dmStyles.label}>希望納期</div>
                  <input type="date" defaultValue={deal.delivery} key={deal.id+'d'} style={{ ...dmStyles.input, fontFamily:"'Fraunces', serif", fontSize:12, padding:'5px 8px' }} />
                </div>
                <div style={dmStyles.field}>
                  <div style={dmStyles.label}>担当</div>
                  <select defaultValue={deal.sales} key={deal.id+'s'} style={{ ...dmStyles.input, fontSize:12, padding:'5px 8px' }}>{window.SALES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                </div>
              </div>
              <div style={dmStyles.field}>
                <div style={dmStyles.label}>工場</div>
                <select defaultValue={deal.factory} key={deal.id+'f'} style={{ ...dmStyles.input, fontSize:12, padding:'5px 8px' }}>{window.FACTORIES.map(f => <option key={f} value={f}>{f}</option>)}</select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={dmStyles.field}><div style={dmStyles.label}>FX</div><input defaultValue="155" key={deal.id+'fx'} style={{ ...dmStyles.input, ...dmStyles.inputNum, fontSize:12, padding:'5px 8px' }} /></div>
                <div style={dmStyles.field}><div style={dmStyles.label}>掛け率</div><input defaultValue="55%" key={deal.id+'r'} style={{ ...dmStyles.input, ...dmStyles.inputNum, fontSize:12, padding:'5px 8px' }} /></div>
              </div>
              <div style={dmStyles.field}>
                <div style={dmStyles.label}>Ver</div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontFamily:"'Fraunces', serif", fontSize:12 }}>{deal.version}</span>
                  <button onClick={() => setTab('history')} style={{ background:'transparent', border:'1px solid #e8e8e6', borderRadius:4, padding:'2px 6px', fontSize:10, cursor:'pointer', color:'#555', fontFamily:'inherit' }}>履歴を見る</button>
                </div>
              </div>
            </div>
          </>
        )}
        {tab === 'history' && <div style={dpStyles.paneFull}><HistoryTab deal={deal} /></div>}
        {tab === 'attachments' && <div style={dpStyles.paneFull}><AttachmentsTab deal={deal} /></div>}
        {tab === 'comms' && <div style={dpStyles.paneFull}><CommsTab deal={deal} /></div>}
      </div>
      <div style={dpStyles.paneFooter}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={() => setDocModal('po')} style={{ background:'#fff', color:'#555', border:'1px solid #e8e8e6', borderRadius:5, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>📄 見積依頼</button>
          <button onClick={() => setDocModal('invoice')} style={{ background:'#fff', color:'#555', border:'1px solid #e8e8e6', borderRadius:5, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>💴 請求書</button>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:9, color:'#bbb' }}>更新 {window.fmtDate(deal.updated)}</span>
          <button style={{ background:'#0a0a0a', color:'#fff', border:'none', borderRadius:5, padding:'5px 12px', fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>保存</button>
        </div>
      </div>
      {docModal && <window.DocGeneratorModal deal={deal} type={docModal} onClose={() => setDocModal(null)} />}
    </div>
  );
}

window.DealDetailPane = DealDetailPane;
