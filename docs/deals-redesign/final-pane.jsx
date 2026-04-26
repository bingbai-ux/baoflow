// Final integrated right pane — when a deal is selected
// Compact: 詳細 | バリエーション | 履歴 | 添付 | 通信

const fpStyles = {
  empty: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, color:'#bbb', fontSize:11, padding:30, textAlign:'center' },
  emptyIllust: { width:60, height:60, borderRadius:30, background:'#fafaf9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, color:'#ddd', fontFamily:"'Fraunces', serif" },
  emptyTitle: { fontFamily:"'Fraunces', serif", fontSize:13, color:'#888', fontWeight:600 },
  emptyHint: { fontSize:10.5, color:'#aaa', lineHeight:1.6, maxWidth:240 },

  head: { padding:'14px 16px 12px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'flex-start', gap:10 },
  thumb: { width:42, height:42, borderRadius:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontFamily:"'Fraunces', serif", fontWeight:600, color:'#0a0a0a' },
  headBody: { flex:1, minWidth:0 },
  headId: { fontFamily:"'Fraunces', serif", fontSize:10, color:'#888', letterSpacing:'0.04em' },
  headName: { fontSize:13.5, fontWeight:600, marginTop:1, lineHeight:1.3 },
  headSub: { fontSize:10, color:'#888', marginTop:4 },
  closeBtn: { width:24, height:24, borderRadius:6, border:'none', background:'transparent', color:'#888', cursor:'pointer', fontSize:16, lineHeight:1, alignSelf:'flex-start' },

  // Status pipeline tiny
  pipeline: { padding:'10px 16px', display:'flex', alignItems:'center', gap:0, borderBottom:'1px solid #e8e8e6', overflowX:'auto', background:'#fafaf9' },
  pipeStep: { display:'flex', flexDirection:'column', alignItems:'center', gap:3, flex:1, minWidth:50, position:'relative', cursor:'pointer' },
  pipeDot: { width:18, height:18, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:8, fontFamily:"'Fraunces', serif", fontWeight:600 },
  pipeLine: { position:'absolute', top:9, left:'62%', right:'-38%', height:1.5, zIndex:0 },
  pipeLabel: { fontSize:9, color:'#888', fontWeight:500, textAlign:'center' },

  // Tabs
  tabs: { display:'flex', padding:'0 12px', borderBottom:'1px solid #e8e8e6', fontSize:11, gap:0, flexShrink:0 },
  tab: { padding:'8px 11px', cursor:'pointer', borderBottom:'2px solid transparent', color:'#888' },
  tabActive: { color:'#0a0a0a', borderBottomColor:'#0a0a0a', fontWeight:600 },
  tabBadge: { marginLeft:4, fontSize:9, color:'#aaa', fontFamily:"'Fraunces', serif" },

  // Body
  body: { flex:1, overflow:'auto', padding:'14px 16px 24px', fontSize:11.5, lineHeight:1.5 },

  // Field rows
  field: { display:'flex', gap:10, padding:'7px 0', borderBottom:'1px dashed #f1f0ec' },
  fieldKey: { width:80, fontSize:10, color:'#888', flexShrink:0, paddingTop:2 },
  fieldVal: { flex:1, fontSize:11.5, color:'#0a0a0a' },
  fieldEdit: { color:'#0a0a0a', cursor:'text', borderBottom:'1px dashed transparent', padding:'1px 0' },

  sectionTitle: { fontSize:9.5, fontWeight:600, color:'#888', letterSpacing:'0.08em', textTransform:'uppercase', marginTop:18, marginBottom:6, fontFamily:"'Fraunces', serif" },

  // Memo
  memo: { padding:10, background:'#fafaf9', border:'1px solid #ececea', borderRadius:6, fontSize:11, lineHeight:1.6, color:'#444', minHeight:50, cursor:'text' },

  // Variant table compact
  vTable: { width:'100%', borderCollapse:'collapse', fontSize:10.5 },
  vTh: { padding:'6px 4px', fontSize:8.5, color:'#888', textAlign:'left', borderBottom:'1px solid #e8e8e6', fontFamily:"'Fraunces', serif", fontWeight:600 },
  vTd: { padding:'7px 4px', borderBottom:'1px solid #f5f4f0' },
  vTdNum: { textAlign:'right', fontFamily:"'Fraunces', serif", fontWeight:500 },

  // Action footer
  footer: { padding:'10px 14px', borderTop:'1px solid #e8e8e6', display:'flex', gap:8, background:'#fafaf9', flexShrink:0 },
  fBtn: { flex:1, padding:'8px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'inherit', border:'1px solid #e0dfd9', background:'#fff', color:'#0a0a0a' },
  fBtnPrimary: { background:'#0a0a0a', color:'#fff', border:'1px solid #0a0a0a', fontWeight:500 },

  // History timeline
  histItem: { display:'flex', gap:10, padding:'8px 0', fontSize:10.5, borderBottom:'1px solid #f5f4f0' },
  histDate: { fontFamily:"'Fraunces', serif", fontSize:10, color:'#aaa', width:60, flexShrink:0 },
  histDot: { width:6, height:6, borderRadius:'50%', marginTop:5, flexShrink:0 },

  // Attachments grid
  attGrid: { display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 },
  attItem: { border:'1px solid #ececea', borderRadius:6, padding:8, fontSize:10, background:'#fff' },
  attThumb: { aspectRatio:'4/3', background:'#fafaf9', borderRadius:4, marginBottom:6, display:'flex', alignItems:'center', justifyContent:'center', color:'#bbb', fontSize:18, fontFamily:"'Fraunces', serif" },

  // Comm
  commItem: { padding:'10px 0', borderBottom:'1px solid #f5f4f0', fontSize:10.5 },
  commHead: { display:'flex', alignItems:'center', gap:6, marginBottom:4 },
  commChip: { fontSize:8.5, padding:'1px 5px', borderRadius:3, background:'#fafaf9', color:'#666', fontFamily:"'Fraunces', serif" },
};

// Reusable inline-editable field
function EditField({ value, onCommit, suffix, fontWeight, type='text', options }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  const commit = () => { setEditing(false); if (draft !== value) onCommit && onCommit(draft); };
  if (!editing) {
    return (
      <span onClick={() => setEditing(true)} style={{ cursor:'text', borderBottom:'1px dashed transparent', padding:'1px 4px', margin:'-1px -4px', borderRadius:3, fontWeight, display:'inline-block', minWidth:30 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fafaf9'; e.currentTarget.style.borderBottomColor = '#ddd'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderBottomColor = 'transparent'; }}>
        {value}{suffix && <span style={{ fontSize:9, color:'#aaa', marginLeft:3 }}>{suffix}</span>}
      </span>
    );
  }
  if (type === 'select') {
    return (
      <select autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              style={{ fontFamily:'inherit', fontSize:'inherit', padding:'2px 4px', border:'1px solid #0a0a0a', borderRadius:3, background:'#fff', outline:'none' }}>
        {(options || []).map(o => <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? o : o.label}</option>)}
      </select>
    );
  }
  return (
    <input autoFocus type={type} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
           onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
           style={{ fontFamily:'inherit', fontSize:'inherit', padding:'2px 4px', border:'1px solid #0a0a0a', borderRadius:3, outline:'none', width: type === 'number' ? 90 : '95%', fontWeight }} />
  );
}

window.EditField = EditField;

function FinalDealPane({ deal: dealProp, ccy, onClose, onCreateDoc }) {
  const [tab, setTab] = React.useState('details');
  const [deal, setDeal] = React.useState(dealProp);
  React.useEffect(() => setDeal(dealProp), [dealProp && dealProp.id]);
  const update = (patch) => setDeal(prev => ({ ...prev, ...patch }));
  const updateVariant = (idx, patch) => setDeal(prev => ({ ...prev, variants: prev.variants.map((v, i) => i === idx ? { ...v, ...patch } : v) }));
  if (!deal) {
    return (
      <div style={fpStyles.empty}>
        <div style={fpStyles.emptyIllust}>◯</div>
        <div style={fpStyles.emptyTitle}>案件を選択</div>
        <div style={fpStyles.emptyHint}>左の表から案件をクリックすると、詳細・履歴・添付・通信がここに表示されます。<br/><br/><span style={{ background:'#fafaf9', border:'1px solid #e8e8e6', borderRadius:3, padding:'1px 5px', fontFamily:'monospace', fontSize:9 }}>j</span> / <span style={{ background:'#fafaf9', border:'1px solid #e8e8e6', borderRadius:3, padding:'1px 5px', fontFamily:'monospace', fontSize:9 }}>k</span> で前後の案件へ移動</div>
      </div>
    );
  }
  const client = window.CLIENTS.find(c => c.id === deal.client);
  const stat = window.STATUS[deal.status];
  const colors = ['#e8d4b8','#d4c5a3','#c9d4c5','#b8c8d4','#d4b8c5','#c8b8d4','#b8d4c8','#e0d4b8'];
  let h = 0; for (let i = 0; i < deal.name.length; i++) h = (h * 31 + deal.name.charCodeAt(i)) % 100000;
  const tBg = colors[h % colors.length];
  const variants = deal.variants || [];

  const ccyDisplay = (jpy, usd) => {
    if (ccy === 'JPY') return window.fmtJPY(jpy);
    if (ccy === 'USD') return window.fmtUSD(jpy / window.VARIANT_FX);
    return `${window.fmtJPY(jpy)} / ${window.fmtUSD(jpy / window.VARIANT_FX)}`;
  };

  const currentIdx = window.STATUS_ORDER.indexOf(deal.status);

  return (
    <>
      <div style={fpStyles.head}>
        <div style={{ ...fpStyles.thumb, background:tBg }}>{deal.name.charAt(0)}</div>
        <div style={fpStyles.headBody}>
          <div style={fpStyles.headId}>{deal.id} · {client.short}</div>
          <div style={fpStyles.headName}>{deal.name}</div>
          <div style={fpStyles.headSub}>{deal.spec}</div>
        </div>
        <button style={fpStyles.closeBtn} onClick={onClose}>×</button>
      </div>

      {/* mini status pipeline */}
      <div style={fpStyles.pipeline}>
        {window.STATUS_ORDER.map((s, i) => {
          const cfg = window.STATUS[s];
          const done = i < currentIdx;
          const cur = i === currentIdx;
          let bg = '#e0dfd9', col = '#888', icon = i+1;
          if (done) { bg = '#0a0a0a'; col = '#fff'; icon = '✓'; }
          if (cur) { bg = cfg.dot; col = '#fff'; icon = '●'; }
          return (
            <div key={s} style={fpStyles.pipeStep}>
              <div style={{ ...fpStyles.pipeDot, background:bg, color:col }}>{icon}</div>
              <div style={{ ...fpStyles.pipeLabel, color: cur ? '#0a0a0a' : '#888', fontWeight: cur ? 600 : 500 }}>{cfg.short}</div>
              {i < window.STATUS_ORDER.length - 1 && <div style={{ ...fpStyles.pipeLine, background: done ? '#0a0a0a' : '#e0dfd9' }}></div>}
            </div>
          );
        })}
      </div>

      <div style={fpStyles.tabs}>
        {[
          { k:'details', label:'詳細' },
          { k:'variants', label:'バリエーション', badge:variants.length },
          { k:'history', label:'履歴' },
          { k:'attachments', label:'添付' },
          { k:'comms', label:'通信' },
        ].map(t => (
          <div key={t.k} onClick={() => setTab(t.k)} style={{ ...fpStyles.tab, ...(tab===t.k ? fpStyles.tabActive : {}) }}>
            {t.label}{t.badge && <span style={fpStyles.tabBadge}>{t.badge}</span>}
          </div>
        ))}
      </div>

      <div style={fpStyles.body}>
        {tab === 'details' && (
          <>
            <div style={fpStyles.sectionTitle}>基本</div>
            <div style={fpStyles.field}><div style={fpStyles.fieldKey}>取引先</div><div style={fpStyles.fieldVal}>
              <window.EditField value={client.name} type="select" options={window.CLIENTS.map(c => ({ value:c.id, label:c.name }))} onCommit={(v) => update({ client: v })} />
            </div></div>
            <div style={fpStyles.field}><div style={fpStyles.fieldKey}>案件名</div><div style={fpStyles.fieldVal}>
              <window.EditField value={deal.name} onCommit={(v) => update({ name: v })} fontWeight={500} />
            </div></div>
            <div style={fpStyles.field}><div style={fpStyles.fieldKey}>仕様</div><div style={fpStyles.fieldVal}>
              <window.EditField value={deal.spec} onCommit={(v) => update({ spec: v })} />
            </div></div>
            <div style={fpStyles.field}><div style={fpStyles.fieldKey}>担当営業</div><div style={fpStyles.fieldVal}>
              <window.EditField value={deal.sales} type="select" options={window.SALES} onCommit={(v) => update({ sales: v })} />
            </div></div>
            <div style={fpStyles.field}><div style={fpStyles.fieldKey}>納期</div><div style={fpStyles.fieldVal}>
              <window.EditField value={deal.delivery} type="date" onCommit={(v) => update({ delivery: v })} />
            </div></div>

            <div style={fpStyles.sectionTitle}>採用 (メイン)</div>
            <div style={fpStyles.field}><div style={fpStyles.fieldKey}>数量</div><div style={fpStyles.fieldVal}>
              <window.EditField value={deal.qty} type="number" onCommit={(v) => update({ qty: parseInt(v)||0 })} suffix="個" />
            </div></div>
            <div style={fpStyles.field}><div style={fpStyles.fieldKey}>単価</div><div style={fpStyles.fieldVal}>
              $<window.EditField value={deal.unit_usd} type="number" onCommit={(v) => update({ unit_usd: parseFloat(v)||0 })} suffix="/個" />
            </div></div>
            <div style={fpStyles.field}><div style={fpStyles.fieldKey}>請求合計</div><div style={fpStyles.fieldVal}>
              ¥<window.EditField value={deal.total_jpy} type="number" onCommit={(v) => update({ total_jpy: parseInt(v)||0 })} fontWeight={600} />
            </div></div>
            <div style={fpStyles.field}><div style={fpStyles.fieldKey}>粗利</div><div style={fpStyles.fieldVal}>
              <window.EditField value={deal.profit_pct} type="number" onCommit={(v) => update({ profit_pct: parseFloat(v)||0 })} suffix="%" />
            </div></div>

            <div style={fpStyles.sectionTitle}>製造</div>
            <div style={fpStyles.field}><div style={fpStyles.fieldKey}>工場</div><div style={fpStyles.fieldVal}>
              <window.EditField value={deal.factory} type="select" options={['—', ...window.FACTORIES]} onCommit={(v) => update({ factory: v })} />
            </div></div>
            <div style={fpStyles.field}><div style={fpStyles.fieldKey}>ステータス</div><div style={fpStyles.fieldVal}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:stat.dot }}></span>
                <window.EditField value={deal.status} type="select"
                  options={window.STATUS_ORDER.map(s => ({ value:s, label:window.STATUS[s].label }))}
                  onCommit={(v) => update({ status: v })} />
              </span>
            </div></div>

            <div style={fpStyles.sectionTitle}>メモ</div>
            <div style={fpStyles.memo} contentEditable suppressContentEditableWarning
                 onBlur={(e) => update({ memo: e.currentTarget.textContent })}>{deal.memo || 'メモを追加…'}</div>
          </>
        )}

        {tab === 'variants' && (
          <>
            <div style={{ marginBottom:8, fontSize:10.5, color:'#888' }}>同一仕様で数量・価格の選択肢。採用ボタンで切替できます。</div>
            <table style={fpStyles.vTable}>
              <thead>
                <tr>
                  <th style={fpStyles.vTh}></th>
                  <th style={fpStyles.vTh}>区分</th>
                  <th style={{ ...fpStyles.vTh, textAlign:'right' }}>数量</th>
                  <th style={{ ...fpStyles.vTh, textAlign:'right' }}>単価</th>
                  <th style={{ ...fpStyles.vTh, textAlign:'right' }}>合計</th>
                  <th style={{ ...fpStyles.vTh, textAlign:'right' }}>粗利</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, vi) => {
                  const adopt = vi === 1;
                  return (
                    <tr key={vi} style={{ background: adopt ? '#fff8e8' : 'transparent' }}>
                      <td style={fpStyles.vTd}>
                        <button style={{ ...fdStyles.variantAdoptBtn, ...(adopt ? fdStyles.variantAdoptBtnActive : {}) }}>
                          {adopt ? '採用 ✓' : '採用'}
                        </button>
                      </td>
                      <td style={fpStyles.vTd}>
                        <window.EditField value={v.note} onCommit={(val) => updateVariant(vi, { note: val })} /> · v<window.EditField value={v.version} onCommit={(val) => updateVariant(vi, { version: val })} />
                      </td>
                      <td style={{ ...fpStyles.vTd, ...fpStyles.vTdNum }}>
                        <window.EditField value={v.qty} type="number" onCommit={(val) => updateVariant(vi, { qty: parseInt(val)||0 })} />
                      </td>
                      <td style={{ ...fpStyles.vTd, ...fpStyles.vTdNum }}>
                        $<window.EditField value={v.unit_usd} type="number" onCommit={(val) => updateVariant(vi, { unit_usd: parseFloat(val)||0 })} />
                      </td>
                      <td style={{ ...fpStyles.vTd, ...fpStyles.vTdNum, fontWeight:600 }}>
                        ¥<window.EditField value={v.total_jpy} type="number" onCommit={(val) => updateVariant(vi, { total_jpy: parseInt(val)||0 })} fontWeight={600} />
                      </td>
                      <td style={{ ...fpStyles.vTd, ...fpStyles.vTdNum }}>
                        <window.EditField value={v.profit_pct} type="number" onCommit={(val) => updateVariant(vi, { profit_pct: parseFloat(val)||0 })} suffix="%" />
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={6} style={{ padding:'10px 0', textAlign:'center', fontSize:10.5, color:'#888', cursor:'pointer', borderBottom:'none' }}>+ バリエーションを追加</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {tab === 'history' && (
          <>
            <div style={fpStyles.sectionTitle}>最近の活動</div>
            {[
              { date:'04/22', dot:'#0a0a0a', who:'田中', text:'ステータスを「製作中」に変更' },
              { date:'04/20', dot:'#888',     who:'田中', text:'数量を 4500→5000 に修正' },
              { date:'04/18', dot:'#888',     who:'佐藤', text:'バリエーション「大量」を追加' },
              { date:'04/15', dot:'#888',     who:'田中', text:'仕様書PDF v2 を添付' },
              { date:'04/12', dot:'#888',     who:'システム', text:'発注書を自動生成' },
              { date:'04/10', dot:'#0a0a0a', who:'田中', text:'ステータスを「データ確認」→「入金」に変更' },
              { date:'04/05', dot:'#888',     who:'システム', text:'請求書を自動生成・送付' },
            ].map((h, i) => (
              <div key={i} style={fpStyles.histItem}>
                <span style={fpStyles.histDate}>{h.date}</span>
                <span style={{ ...fpStyles.histDot, background:h.dot }}></span>
                <span style={{ flex:1 }}><span style={{ color:'#0a0a0a', fontWeight:500 }}>{h.who}</span> · {h.text}</span>
              </div>
            ))}
          </>
        )}

        {tab === 'attachments' && (
          <>
            <div style={fpStyles.sectionTitle}>仕様書 (2)</div>
            <div style={fpStyles.attGrid}>
              {[
                { ic:'📄', name:'spec_v3.pdf', size:'214KB' },
                { ic:'📄', name:'spec_v2.pdf', size:'198KB' },
              ].map((f, i) => (
                <div key={i} style={fpStyles.attItem}>
                  <div style={fpStyles.attThumb}>{f.ic}</div>
                  <div style={{ fontWeight:500, fontSize:10 }}>{f.name}</div>
                  <div style={{ color:'#aaa', fontSize:9, fontFamily:"'Fraunces', serif" }}>{f.size}</div>
                </div>
              ))}
            </div>
            <div style={fpStyles.sectionTitle}>サンプル写真 (3)</div>
            <div style={fpStyles.attGrid}>
              {['#e8d4b8','#d4c5a3','#c9d4c5'].map((c, i) => (
                <div key={i} style={fpStyles.attItem}>
                  <div style={{ ...fpStyles.attThumb, background:c }}>◌</div>
                  <div style={{ fontWeight:500, fontSize:10 }}>sample_{i+1}.jpg</div>
                  <div style={{ color:'#aaa', fontSize:9, fontFamily:"'Fraunces', serif" }}>1.2MB</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:12, padding:14, border:'1px dashed #d8d6cf', borderRadius:6, textAlign:'center', color:'#888', fontSize:10.5, cursor:'pointer' }}>+ ファイルをドロップ または クリックして追加</div>
          </>
        )}

        {tab === 'comms' && (
          <>
            <div style={fpStyles.commItem}>
              <div style={fpStyles.commHead}>
                <span style={{ ...fpStyles.commChip, background:'#fdeae3', color:'#c0392b' }}>工場</span>
                <span style={{ fontWeight:500 }}>Zhang Wei</span>
                <span style={{ color:'#aaa', fontSize:9.5, marginLeft:'auto', fontFamily:"'Fraunces', serif" }}>04/22 14:32</span>
              </div>
              <div style={{ color:'#444' }}>箔押し版代USD180追加でお願いします。納期は5/10で間に合います。</div>
            </div>
            <div style={fpStyles.commItem}>
              <div style={fpStyles.commHead}>
                <span style={{ ...fpStyles.commChip, background:'#e7f0e6', color:'#3a7d36' }}>クライアント</span>
                <span style={{ fontWeight:500 }}>丸山 健介</span>
                <span style={{ color:'#aaa', fontSize:9.5, marginLeft:'auto', fontFamily:"'Fraunces', serif" }}>04/20 10:11</span>
              </div>
              <div style={{ color:'#444' }}>母の日キャンペーンに合わせるので5/12納品厳守でお願いします。</div>
            </div>
            <div style={fpStyles.commItem}>
              <div style={fpStyles.commHead}>
                <span style={{ ...fpStyles.commChip }}>内部</span>
                <span style={{ fontWeight:500 }}>佐藤</span>
                <span style={{ color:'#aaa', fontSize:9.5, marginLeft:'auto', fontFamily:"'Fraunces', serif" }}>04/18 09:50</span>
              </div>
              <div style={{ color:'#444' }}>@田中 大量ロット案も提示しておきました</div>
            </div>
            <div style={{ marginTop:14, padding:10, border:'1px solid #e8e8e6', borderRadius:6, fontSize:10.5, color:'#aaa' }}>メッセージを書く… (@で社内メンション)</div>
          </>
        )}
      </div>

      <div style={fpStyles.footer}>
        <button style={fpStyles.fBtn} onClick={() => onCreateDoc('quotation')}>見積書</button>
        <button style={fpStyles.fBtn} onClick={() => onCreateDoc('invoice')}>請求書</button>
        <button style={fpStyles.fBtn} onClick={() => onCreateDoc('po')}>見積依頼</button>
        <button style={{ ...fpStyles.fBtn, ...fpStyles.fBtnPrimary }}>状態を進める →</button>
      </div>
    </>
  );
}

window.FinalDealPane = FinalDealPane;
window.fpStyles = fpStyles;
window.fdStyles = window.fdStyles; // ensure access
