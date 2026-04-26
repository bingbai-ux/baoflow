// Master / 取引先管理 — 3 layout variations × (clients | factories)
// Variations:
//   A: テーブル一覧 + 右スライド詳細パネル
//   B: 左リスト + 右常時詳細
//   C: カードグリッド + フォーカス詳細
// Style language matches the rest of the project (Fraunces nums, hairline rows, #fffaf2 alerts, etc).

const masterStyles = {
  // toolbar / shell
  shell: {
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
    gap:14,
  },
  tabs: { display:'flex', gap:0, alignItems:'center' },
  tab: (active) => ({
    padding:'7px 14px', fontSize:12, cursor:'pointer',
    fontFamily:"'Fraunces', serif", fontWeight:500,
    color: active ? '#0a0a0a' : '#888',
    borderBottom: active ? '2px solid #0a0a0a' : '2px solid transparent',
    marginBottom:-11,
  }),
  count: {
    fontSize:10, color:'#888', marginLeft:6,
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
  },
  search: {
    flex:1, maxWidth:280, padding:'6px 10px',
    fontSize:11, border:'1px solid rgba(0,0,0,0.08)', borderRadius:6,
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
    background:'#fafaf9',
  },
  layoutSwitch: {
    display:'flex', background:'#fafaf9', borderRadius:6,
    border:'1px solid rgba(0,0,0,0.06)', overflow:'hidden',
  },
  lsBtn: (active) => ({
    padding:'6px 10px', fontSize:10, cursor:'pointer',
    background: active ? '#0a0a0a' : 'transparent',
    color: active ? '#fff' : '#666',
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
  }),
  newBtn: {
    background:'#0a0a0a', color:'#fff', border:'none',
    padding:'7px 12px', fontSize:11, borderRadius:6, cursor:'pointer',
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
  },

  // === Layout A: table + slide panel
  tableHead: {
    display:'grid', gap:10, alignItems:'center',
    padding:'8px 14px', fontSize:9, color:'#bbb',
    textTransform:'uppercase', letterSpacing:'0.06em',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    background:'#fafaf9',
  },
  tableRow: (selected) => ({
    display:'grid', gap:10, alignItems:'center',
    padding:'9px 14px', fontSize:11, lineHeight:1.3,
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    background: selected ? '#f4f4f1' : '#fff',
    cursor:'pointer',
  }),
  cellName: { fontFamily:"'Fraunces', serif", fontSize:13, fontWeight:500 },
  cellSub:  { fontSize:10, color:'#888', marginTop:1 },
  cellNum:  { fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', textAlign:'right' },
  tag: (color='#f4f4f1') => ({
    display:'inline-block', padding:'1.5px 6px', borderRadius:3,
    background: color, fontSize:9, color:'#555', marginRight:3,
  }),

  // panels
  panelOverlay: (open) => ({
    position:'absolute', top:0, right:0, bottom:0,
    width: open ? 460 : 0,
    background:'#fff', borderLeft:'1px solid rgba(0,0,0,0.08)',
    transition:'width 0.18s ease',
    overflow:'hidden',
    boxShadow: open ? '-8px 0 24px rgba(0,0,0,0.04)' : 'none',
    display:'flex', flexDirection:'column',
    zIndex:20,
  }),
  panelHeader: {
    padding:'14px 18px 12px', borderBottom:'1px solid rgba(0,0,0,0.06)',
    display:'flex', alignItems:'flex-start', justifyContent:'space-between',
  },
  panelClose: {
    width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center',
    cursor:'pointer', color:'#888', fontSize:16,
  },
  panelBody: { flex:1, overflowY:'auto', padding:'14px 18px 24px' },

  detailH: {
    fontFamily:"'Fraunces', serif", fontWeight:600,
    fontSize:18, lineHeight:1.2, marginBottom:2,
  },
  detailHsub: { fontSize:11, color:'#888' },
  section: { marginTop:18 },
  sectionH: {
    fontSize:9, color:'#bbb', textTransform:'uppercase',
    letterSpacing:'0.08em', marginBottom:8,
    display:'flex', alignItems:'center', justifyContent:'space-between',
  },
  fieldRow: {
    display:'grid', gridTemplateColumns:'90px 1fr', gap:8,
    fontSize:11, padding:'5px 0',
    borderBottom:'1px solid rgba(0,0,0,0.03)',
  },
  fieldLabel: { color:'#888', fontSize:10 },
  fieldVal:   { color:'#0a0a0a', lineHeight:1.5 },

  // rollup KPIs
  rollupRow: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 },
  rollup: {
    background:'#fafaf9', borderRadius:8, padding:'10px 12px',
    border:'1px solid rgba(0,0,0,0.04)',
  },
  rollupLabel: { fontSize:9, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' },
  rollupVal: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:18, fontWeight:500, marginTop:2,
  },
  rollupSub: { fontSize:10, color:'#888' },

  // history mini-rows
  histRow: {
    display:'grid', gridTemplateColumns:'62px 1fr 90px',
    gap:8, padding:'7px 0', fontSize:11,
    borderBottom:'1px solid rgba(0,0,0,0.04)', alignItems:'center',
  },
  histId: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:10, color:'#888',
  },

  // attachments
  attRow: {
    display:'flex', alignItems:'center', gap:10,
    padding:'8px 10px', borderRadius:6,
    background:'#fafaf9', marginBottom:6, fontSize:11,
    cursor:'pointer',
  },
  attIcon: {
    width:24, height:30, borderRadius:3, background:'#0a0a0a',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'#fff', fontSize:7, fontWeight:600, flexShrink:0,
  },

  // === Layout B: split list/detail
  splitWrap: { display:'flex', height: 720 },
  splitList: {
    width:300, borderRight:'1px solid rgba(0,0,0,0.06)',
    overflowY:'auto', flexShrink:0,
  },
  splitListItem: (active) => ({
    padding:'12px 14px', cursor:'pointer',
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    background: active ? '#0a0a0a' : '#fff',
    color: active ? '#fff' : '#0a0a0a',
  }),
  splitDetail: { flex:1, overflowY:'auto', padding:'20px 26px' },

  // === Layout C: card grid
  grid: {
    display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',
    gap:12, padding:14,
  },
  card: {
    background:'#fff', border:'1px solid rgba(0,0,0,0.06)', borderRadius:12,
    padding:'14px 16px', cursor:'pointer',
    display:'flex', flexDirection:'column', gap:8,
    transition:'transform 0.12s ease, box-shadow 0.12s ease',
  },
  cardHead: { display:'flex', justifyContent:'space-between', alignItems:'flex-start' },

  // factory specialties
  specRow: { display:'flex', flexWrap:'wrap', gap:4 },

  // stars
  starRow: { display:'flex', alignItems:'center', gap:6, fontSize:11 },
  starGroup: { display:'inline-flex', gap:1 },
};

// === aggregate helpers ===
function clientStats(c) {
  const list = DEALS.filter(d => d.client === c.id);
  const total = list.reduce((s,d) => s + d.total_jpy, 0);
  const active = list.filter(d => d.status !== 'delivered');
  const avgProfit = list.length ? +(list.reduce((s,d) => s + d.profit_pct, 0) / list.length).toFixed(1) : 0;
  const sinceDate = c.since ? new Date(c.since) : null;
  return { list, active, total, avgProfit, sinceDate };
}
function factoryStats(f) {
  const list = DEALS.filter(d => d.factory === f.name);
  const total = list.reduce((s,d) => s + d.total_jpy, 0);
  const active = list.filter(d => d.status !== 'delivered');
  const onTime = list.length ? Math.round((list.filter(d => d.status === 'delivered').length / list.length) * 100) : 0;
  return { list, active, total, onTime };
}

// === STAR rendering ===
function Stars({ value, size = 11 }) {
  return (
    <span style={{ display:'inline-flex', gap:1, color:'#0a0a0a' }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ fontSize:size, opacity: n <= value ? 1 : 0.18 }}>★</span>
      ))}
    </span>
  );
}

// === Field row ===
function Field({ label, children }) {
  return (
    <div style={masterStyles.fieldRow}>
      <div style={masterStyles.fieldLabel}>{label}</div>
      <div style={masterStyles.fieldVal}>{children}</div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Detail body (shared between A's panel, B's right pane, C's focus)
// ───────────────────────────────────────────────────────────
function ClientDetail({ c, onClose }) {
  const { list, active, total, avgProfit } = clientStats(c);

  return (
    <>
      <div style={masterStyles.panelHeader}>
        <div>
          <div style={masterStyles.detailH}>{c.name}</div>
          <div style={masterStyles.detailHsub}>{c.industry} · {c.id} · 取引開始 {fmtDateLong(c.since)}</div>
        </div>
        {onClose && <div style={masterStyles.panelClose} onClick={onClose}>✕</div>}
      </div>

      <div style={masterStyles.panelBody}>
        {/* rollup */}
        <div style={masterStyles.rollupRow}>
          <div style={masterStyles.rollup}>
            <div style={masterStyles.rollupLabel}>累計取引額</div>
            <div style={masterStyles.rollupVal}>¥{(total/1000000).toFixed(1)}<span style={{ fontSize:11, color:'#888' }}>M</span></div>
            <div style={masterStyles.rollupSub}>{list.length}件</div>
          </div>
          <div style={masterStyles.rollup}>
            <div style={masterStyles.rollupLabel}>平均粗利</div>
            <div style={masterStyles.rollupVal}>{avgProfit}<span style={{ fontSize:11, color:'#888' }}>%</span></div>
            <div style={masterStyles.rollupSub}>目標 35.0%</div>
          </div>
          <div style={masterStyles.rollup}>
            <div style={masterStyles.rollupLabel}>進行中</div>
            <div style={masterStyles.rollupVal}>{active.length}<span style={{ fontSize:11, color:'#888' }}>件</span></div>
            <div style={masterStyles.rollupSub}>¥{(active.reduce((s,d)=>s+d.total_jpy,0)/1000).toFixed(0)}k</div>
          </div>
        </div>

        {/* basic info */}
        <div style={masterStyles.section}>
          <div style={masterStyles.sectionH}>基本情報<span style={{ fontSize:9, color:'#888', cursor:'pointer', borderBottom:'1px solid #888' }}>編集</span></div>
          <Field label="担当者">{c.contact}</Field>
          <Field label="電話">{c.phone}</Field>
          <Field label="メール"><span style={{ borderBottom:'1px solid #ddd' }}>{c.email}</span></Field>
          <Field label="住所">{c.address}</Field>
          <Field label="業種">{c.industry}</Field>
        </div>

        {/* billing */}
        <div style={masterStyles.section}>
          <div style={masterStyles.sectionH}>請求先情報</div>
          <Field label="請求書送付先">{c.billing_to}</Field>
          <Field label="登録番号">{c.tax_id}</Field>
          <Field label="支払条件">{c.payment_terms}</Field>
          <Field label="税率">{c.tax_rate}%</Field>
        </div>

        {/* history */}
        <div style={masterStyles.section}>
          <div style={masterStyles.sectionH}>取引履歴 ({list.length})</div>
          {list.slice(0,6).map(d => (
            <div key={d.id} style={masterStyles.histRow}>
              <span style={masterStyles.histId}>{d.id}</span>
              <span>
                <div style={{ fontSize:11 }}>{d.name}</div>
                <div style={{ fontSize:10, color:'#888', display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
                  <StatusDot status={d.status} size={4} /> {STATUS[d.status].label} · {fmtDateLong(d.delivery)}
                </div>
              </span>
              <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', textAlign:'right', fontSize:11 }}>{fmtJPY(d.total_jpy)}</span>
            </div>
          ))}
          {list.length > 6 && (
            <div style={{ fontSize:10, color:'#888', marginTop:8, textAlign:'center', cursor:'pointer' }}>
              他 {list.length - 6} 件を表示
            </div>
          )}
        </div>

        {/* attachments */}
        <div style={masterStyles.section}>
          <div style={masterStyles.sectionH}>添付ファイル<span style={{ fontSize:9, color:'#888', cursor:'pointer', borderBottom:'1px solid #888' }}>+ 追加</span></div>
          <div style={masterStyles.attRow}>
            <div style={masterStyles.attIcon}>PDF</div>
            <div style={{ flex:1 }}>
              <div>取引基本契約書.pdf</div>
              <div style={{ fontSize:9, color:'#888' }}>{fmtDateLong(c.since)} · 234 KB</div>
            </div>
          </div>
          <div style={masterStyles.attRow}>
            <div style={{ ...masterStyles.attIcon, background:'#888' }}>XLS</div>
            <div style={{ flex:1 }}>
              <div>{c.short}_価格表_2026.xlsx</div>
              <div style={{ fontSize:9, color:'#888' }}>2026.03.18 · 56 KB</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function FactoryDetail({ f, onClose }) {
  const { list, active, total, onTime } = factoryStats(f);
  const avgStars = ((f.stars.quality + f.stars.delivery + f.stars.price) / 3).toFixed(1);

  return (
    <>
      <div style={masterStyles.panelHeader}>
        <div>
          <div style={masterStyles.detailH}>{f.name}</div>
          <div style={masterStyles.detailHsub}>{f.name_cn} · {f.country} · 取引開始 {fmtDateLong(f.since)}</div>
        </div>
        {onClose && <div style={masterStyles.panelClose} onClick={onClose}>✕</div>}
      </div>
      <div style={masterStyles.panelBody}>
        <div style={masterStyles.rollupRow}>
          <div style={masterStyles.rollup}>
            <div style={masterStyles.rollupLabel}>累計発注額</div>
            <div style={masterStyles.rollupVal}>¥{(total/1000000).toFixed(1)}<span style={{ fontSize:11, color:'#888' }}>M</span></div>
            <div style={masterStyles.rollupSub}>{list.length}件</div>
          </div>
          <div style={masterStyles.rollup}>
            <div style={masterStyles.rollupLabel}>納品実績</div>
            <div style={masterStyles.rollupVal}>{onTime}<span style={{ fontSize:11, color:'#888' }}>%</span></div>
            <div style={masterStyles.rollupSub}>納期通り</div>
          </div>
          <div style={masterStyles.rollup}>
            <div style={masterStyles.rollupLabel}>総合評価</div>
            <div style={masterStyles.rollupVal}>{avgStars}<span style={{ fontSize:11, color:'#888' }}>/5</span></div>
            <div style={masterStyles.rollupSub}><Stars value={Math.round(avgStars)} size={9} /></div>
          </div>
        </div>

        <div style={masterStyles.section}>
          <div style={masterStyles.sectionH}>基本情報<span style={{ fontSize:9, color:'#888', cursor:'pointer', borderBottom:'1px solid #888' }}>編集</span></div>
          <Field label="所在地">{f.country} · {f.city}</Field>
          <Field label="住所">{f.address}</Field>
          <Field label="担当者">{f.contact}</Field>
          <Field label="電話">{f.phone}</Field>
          <Field label="メール"><span style={{ borderBottom:'1px solid #ddd' }}>{f.email}</span></Field>
          <Field label="WeChat">{f.wechat}</Field>
        </div>

        <div style={masterStyles.section}>
          <div style={masterStyles.sectionH}>得意分野</div>
          <div style={masterStyles.specRow}>
            {f.specialties.map(s => (
              <span key={s} style={{ ...masterStyles.tag('#f4f4f1'), fontSize:11, padding:'4px 9px', color:'#0a0a0a' }}>{s}</span>
            ))}
          </div>
        </div>

        <div style={masterStyles.section}>
          <div style={masterStyles.sectionH}>評価</div>
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ flex:1, padding:'10px 12px', background:'#fafaf9', borderRadius:8 }}>
              <div style={{ fontSize:10, color:'#888' }}>品質</div>
              <Stars value={f.stars.quality} size={13} />
            </div>
            <div style={{ flex:1, padding:'10px 12px', background:'#fafaf9', borderRadius:8 }}>
              <div style={{ fontSize:10, color:'#888' }}>納期</div>
              <Stars value={f.stars.delivery} size={13} />
            </div>
            <div style={{ flex:1, padding:'10px 12px', background:'#fafaf9', borderRadius:8 }}>
              <div style={{ fontSize:10, color:'#888' }}>価格</div>
              <Stars value={f.stars.price} size={13} />
            </div>
          </div>
        </div>

        <div style={masterStyles.section}>
          <div style={masterStyles.sectionH}>支払条件 / 物流</div>
          <Field label="Incoterm">{f.incoterm}</Field>
          <Field label="通貨">{f.currency}</Field>
          <Field label="支払条件">{f.payment}</Field>
          <Field label="リードタイム">{f.lead_time}</Field>
        </div>

        <div style={masterStyles.section}>
          <div style={masterStyles.sectionH}>取引履歴 ({list.length})</div>
          {list.slice(0,6).map(d => (
            <div key={d.id} style={masterStyles.histRow}>
              <span style={masterStyles.histId}>{d.id}</span>
              <span>
                <div style={{ fontSize:11 }}>{d.name}</div>
                <div style={{ fontSize:10, color:'#888', display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
                  <StatusDot status={d.status} size={4} /> {STATUS[d.status].label} · {clientById(d.client).short}
                </div>
              </span>
              <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', textAlign:'right', fontSize:11 }}>{fmtJPY(d.total_jpy)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────
// Layout A — Table + Slide Panel
// ───────────────────────────────────────────────────────────
function MasterLayoutA({ tab }) {
  const [selectedId, setSelectedId] = React.useState(null);
  const [query, setQuery] = React.useState('');

  const isClient = tab === 'clients';
  const items = isClient ? CLIENTS : FACTORIES_DATA;
  const filtered = items.filter(it => {
    if (!query) return true;
    const q = query.toLowerCase();
    return it.name.toLowerCase().includes(q) || (it.contact||'').toLowerCase().includes(q);
  });
  const selected = items.find(it => (isClient ? it.id : it.id) === selectedId);

  const cols = isClient
    ? '24px 1.5fr 1fr 1fr 90px 100px 100px 70px'
    : '24px 1.5fr 90px 1.2fr 1fr 90px 90px 80px';

  return (
    <div style={{ position:'relative', height: 720, overflow:'hidden' }}>
      {/* table */}
      <div style={{ height:'100%', overflowY:'auto' }}>
        <div style={{ ...masterStyles.tableHead, gridTemplateColumns: cols }}>
          <div></div>
          <div>{isClient ? 'クライアント' : '工場'}</div>
          {isClient ? <>
            <div>担当者</div>
            <div>請求先 / 支払条件</div>
            <div style={{ textAlign:'right' }}>件数</div>
            <div style={{ textAlign:'right' }}>累計取引額</div>
            <div style={{ textAlign:'right' }}>粗利%</div>
            <div style={{ textAlign:'right' }}>進行中</div>
          </> : <>
            <div>都市</div>
            <div>得意分野</div>
            <div>担当 / 連絡先</div>
            <div style={{ textAlign:'right' }}>件数</div>
            <div style={{ textAlign:'right' }}>評価</div>
            <div style={{ textAlign:'right' }}>納期</div>
          </>}
        </div>

        {filtered.map(it => {
          const sel = it.id === selectedId;
          if (isClient) {
            const stats = clientStats(it);
            return (
              <div key={it.id}
                style={{ ...masterStyles.tableRow(sel), gridTemplateColumns: cols }}
                onClick={() => setSelectedId(it.id)}
              >
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#0a0a0a', opacity: sel ? 1 : 0 }} />
                <div>
                  <div style={masterStyles.cellName}>{it.name}</div>
                  <div style={masterStyles.cellSub}>{it.industry} · {it.id}</div>
                </div>
                <div>
                  <div>{it.contact}</div>
                  <div style={masterStyles.cellSub}>{it.phone}</div>
                </div>
                <div style={{ fontSize:10, color:'#555' }}>
                  <div>{it.billing_to}</div>
                  <div style={masterStyles.cellSub}>{it.payment_terms}</div>
                </div>
                <div style={masterStyles.cellNum}>{stats.list.length}</div>
                <div style={masterStyles.cellNum}>¥{(stats.total/1000).toFixed(0)}k</div>
                <div style={masterStyles.cellNum}>{stats.avgProfit}%</div>
                <div style={masterStyles.cellNum}>{stats.active.length}</div>
              </div>
            );
          } else {
            const stats = factoryStats(it);
            const avg = ((it.stars.quality + it.stars.delivery + it.stars.price) / 3).toFixed(1);
            return (
              <div key={it.id}
                style={{ ...masterStyles.tableRow(sel), gridTemplateColumns: cols }}
                onClick={() => setSelectedId(it.id)}
              >
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#0a0a0a', opacity: sel ? 1 : 0 }} />
                <div>
                  <div style={masterStyles.cellName}>{it.name}</div>
                  <div style={masterStyles.cellSub}>{it.name_cn}</div>
                </div>
                <div style={{ fontSize:10 }}>{it.city}</div>
                <div>
                  <div style={masterStyles.specRow}>
                    {it.specialties.slice(0,2).map(s => <span key={s} style={masterStyles.tag()}>{s}</span>)}
                    {it.specialties.length > 2 && <span style={masterStyles.tag()}>+{it.specialties.length - 2}</span>}
                  </div>
                </div>
                <div style={{ fontSize:10 }}>
                  <div>{it.contact}</div>
                  <div style={masterStyles.cellSub}>{it.phone}</div>
                </div>
                <div style={masterStyles.cellNum}>{stats.list.length}</div>
                <div style={{ ...masterStyles.cellNum, fontFamily:"'Zen Kaku Gothic New', sans-serif" }}>
                  <Stars value={Math.round(avg)} size={10} />
                </div>
                <div style={masterStyles.cellNum}>{it.lead_time}</div>
              </div>
            );
          }
        })}
      </div>

      {/* slide panel */}
      <div style={masterStyles.panelOverlay(!!selected)}>
        {selected && (isClient
          ? <ClientDetail c={selected} onClose={() => setSelectedId(null)} />
          : <FactoryDetail f={selected} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Layout B — Split list / right detail
// ───────────────────────────────────────────────────────────
function MasterLayoutB({ tab }) {
  const isClient = tab === 'clients';
  const items = isClient ? CLIENTS : FACTORIES_DATA;
  const [selectedId, setSelectedId] = React.useState(items[0].id);
  const selected = items.find(it => it.id === selectedId);

  return (
    <div style={masterStyles.splitWrap}>
      <div style={masterStyles.splitList}>
        {items.map(it => {
          const active = it.id === selectedId;
          if (isClient) {
            const s = clientStats(it);
            return (
              <div key={it.id} style={masterStyles.splitListItem(active)} onClick={() => setSelectedId(it.id)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                  <span style={{ fontFamily:"'Fraunces', serif", fontSize:13, fontWeight:500 }}>{it.short}</span>
                  <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:11, opacity:.7 }}>{s.list.length}件</span>
                </div>
                <div style={{ fontSize:10, opacity:.6, marginTop:2 }}>{it.industry}</div>
                <div style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:11, marginTop:4 }}>¥{(s.total/1000).toFixed(0)}k</div>
              </div>
            );
          } else {
            const s = factoryStats(it);
            return (
              <div key={it.id} style={masterStyles.splitListItem(active)} onClick={() => setSelectedId(it.id)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                  <span style={{ fontFamily:"'Fraunces', serif", fontSize:13, fontWeight:500 }}>{it.name}</span>
                  <span style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:11, opacity:.7 }}>{s.list.length}件</span>
                </div>
                <div style={{ fontSize:10, opacity:.6, marginTop:2 }}>{it.city} · {it.specialties[0]}</div>
                <div style={{ fontSize:10, marginTop:4, opacity: active ? 1 : 1 }}>
                  <Stars value={Math.round((it.stars.quality + it.stars.delivery + it.stars.price) / 3)} size={10} />
                </div>
              </div>
            );
          }
        })}
      </div>
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {selected && (isClient
          ? <ClientDetail c={selected} />
          : <FactoryDetail f={selected} />
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Layout C — Card grid
// ───────────────────────────────────────────────────────────
function MasterLayoutC({ tab }) {
  const isClient = tab === 'clients';
  const items = isClient ? CLIENTS : FACTORIES_DATA;
  const [focusId, setFocusId] = React.useState(null);
  const focused = items.find(it => it.id === focusId);

  return (
    <div style={{ position:'relative', height:720, overflowY:'auto' }}>
      <div style={masterStyles.grid}>
        {items.map(it => {
          if (isClient) {
            const s = clientStats(it);
            return (
              <div key={it.id} style={masterStyles.card} onClick={() => setFocusId(it.id)}>
                <div style={masterStyles.cardHead}>
                  <div>
                    <div style={{ fontFamily:"'Fraunces', serif", fontSize:14, fontWeight:600 }}>{it.name}</div>
                    <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{it.industry}</div>
                  </div>
                  <div style={{ fontSize:9, color:'#bbb', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{it.id}</div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, paddingTop:8, borderTop:'1px solid rgba(0,0,0,0.04)' }}>
                  <div>
                    <div style={{ fontSize:9, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>累計</div>
                    <div style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:16, fontWeight:500, marginTop:2 }}>¥{(s.total/1000).toFixed(0)}k</div>
                  </div>
                  <div>
                    <div style={{ fontSize:9, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>件数 / 進行中</div>
                    <div style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:16, fontWeight:500, marginTop:2 }}>{s.list.length} <span style={{ color:'#888', fontSize:11 }}>/ {s.active.length}進</span></div>
                  </div>
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#888', marginTop:'auto', paddingTop:6 }}>
                  <span>{it.contact}</span>
                  <span>取引開始 {fmtDateLong(it.since)}</span>
                </div>
              </div>
            );
          } else {
            const s = factoryStats(it);
            const avg = ((it.stars.quality + it.stars.delivery + it.stars.price) / 3).toFixed(1);
            return (
              <div key={it.id} style={masterStyles.card} onClick={() => setFocusId(it.id)}>
                <div style={masterStyles.cardHead}>
                  <div>
                    <div style={{ fontFamily:"'Fraunces', serif", fontSize:14, fontWeight:600 }}>{it.name}</div>
                    <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{it.country} · {it.city}</div>
                  </div>
                  <div style={{ fontSize:11 }}>
                    <Stars value={Math.round(avg)} size={11} />
                  </div>
                </div>

                <div style={masterStyles.specRow}>
                  {it.specialties.map(sp => <span key={sp} style={masterStyles.tag()}>{sp}</span>)}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, paddingTop:8, borderTop:'1px solid rgba(0,0,0,0.04)' }}>
                  <div>
                    <div style={{ fontSize:9, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>累計発注</div>
                    <div style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:16, fontWeight:500, marginTop:2 }}>¥{(s.total/1000).toFixed(0)}k</div>
                  </div>
                  <div>
                    <div style={{ fontSize:9, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>リードタイム</div>
                    <div style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:13, fontWeight:500, marginTop:2 }}>{it.lead_time}</div>
                  </div>
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#888', marginTop:'auto', paddingTop:6 }}>
                  <span>{it.contact}</span>
                  <span>{it.incoterm}</span>
                </div>
              </div>
            );
          }
        })}
      </div>

      {/* focus overlay */}
      {focused && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,0.18)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:24,
          zIndex:30,
        }} onClick={() => setFocusId(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            width:560, maxHeight:'90%', background:'#fff', borderRadius:12,
            display:'flex', flexDirection:'column', overflow:'hidden',
            boxShadow:'0 12px 40px rgba(0,0,0,0.18)',
          }}>
            {isClient
              ? <ClientDetail c={focused} onClose={() => setFocusId(null)} />
              : <FactoryDetail f={focused} onClose={() => setFocusId(null)} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Master shell (toolbar + tabs + variant content)
// ───────────────────────────────────────────────────────────
function MasterScreen({ defaultTab = 'clients' }) {
  const [tab, setTab] = React.useState(defaultTab);

  return (
    <div style={masterStyles.shell}>
      <div style={masterStyles.toolbar}>
        <div style={masterStyles.tabs}>
          <div style={masterStyles.tab(tab === 'clients')} onClick={() => setTab('clients')}>
            クライアント<span style={masterStyles.count}>{CLIENTS.length}</span>
          </div>
          <div style={masterStyles.tab(tab === 'factories')} onClick={() => setTab('factories')}>
            工場<span style={masterStyles.count}>{FACTORIES_DATA.length}</span>
          </div>
        </div>
        <input style={masterStyles.search} placeholder={`${tab === 'clients' ? 'クライアント' : '工場'}を検索…`} />
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button style={masterStyles.newBtn}>+ {tab === 'clients' ? 'クライアント' : '工場'}</button>
        </div>
      </div>

      <MasterLayoutB tab={tab} />
    </div>
  );
}

Object.assign(window, { MasterScreen, MasterLayoutB });
