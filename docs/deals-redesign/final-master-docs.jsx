// Final integrated Master + Docs hub views

const fmStyles = {
  wrap: { flex:1, display:'flex', minWidth:0, background:'#fff' },
  list: { width:300, borderRight:'1px solid #e8e8e6', overflow:'auto', flexShrink:0, background:'#fafaf9' },
  listTabs: { display:'flex', padding:'8px 12px 0', gap:0, fontSize:11 },
  listTab: { padding:'6px 10px', cursor:'pointer', borderBottom:'2px solid transparent', color:'#888' },
  listTabActive: { color:'#0a0a0a', borderBottomColor:'#0a0a0a', fontWeight:600 },
  listSearch: { padding:'8px 12px', borderBottom:'1px solid #e8e8e6' },
  searchInput: { width:'100%', padding:'7px 10px', border:'1px solid #e0dfd9', borderRadius:6, fontSize:11, fontFamily:'inherit', background:'#fff', boxSizing:'border-box' },
  listItem: { padding:'12px 14px', borderBottom:'1px solid #efeeea', cursor:'pointer', fontSize:11.5 },
  listItemActive: { background:'#fff', borderLeft:'3px solid #0a0a0a', paddingLeft:11 },
  listName: { fontWeight:500, marginBottom:2 },
  listMeta: { fontSize:10, color:'#888' },
  listStat: { display:'flex', gap:8, marginTop:4, fontSize:9.5, color:'#888', fontFamily:"'Fraunces', serif" },

  detail: { flex:1, overflow:'auto', padding:'24px 28px 60px' },
  detailHead: { display:'flex', alignItems:'flex-start', gap:14, marginBottom:18, paddingBottom:14, borderBottom:'1px solid #e8e8e6' },
  detailLogo: { width:60, height:60, borderRadius:10, background:'#fafaf9', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Fraunces', serif", fontSize:22, fontWeight:600, flexShrink:0 },
  detailName: { fontFamily:"'Fraunces', serif", fontSize:20, fontWeight:600, marginBottom:2 },
  detailMeta: { fontSize:11, color:'#888' },

  twoCol: { display:'grid', gridTemplateColumns:'1.6fr 1fr', gap:24 },
  card: { border:'1px solid #e8e8e6', borderRadius:10, padding:16, marginBottom:14, background:'#fff' },
  cardTitle: { fontFamily:"'Fraunces', serif", fontSize:11, fontWeight:600, color:'#888', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10 },
  field: { display:'flex', gap:10, padding:'5px 0', fontSize:11.5, borderBottom:'1px dashed #f1f0ec' },
  fieldKey: { width:90, color:'#888', fontSize:10.5 },
  fieldVal: { flex:1, color:'#0a0a0a' },
};

function FinalMaster({ onOpenDeal }) {
  const [kind, setKind] = React.useState('clients'); // clients or factories
  const [selId, setSelId] = React.useState('c01');
  const [q, setQ] = React.useState('');
  const list = kind === 'clients' ? window.CLIENTS : window.FACTORIES_DATA;
  const filtered = list.filter(it => !q || JSON.stringify(it).toLowerCase().includes(q.toLowerCase()));
  const sel = list.find(it => it.id === selId) || list[0];
  const isCli = kind === 'clients';

  const sDeals = window.DEALS.filter(d => isCli ? d.client === sel.id : d.factory === sel.name);
  const totalRev = sDeals.reduce((s,d) => s + d.total_jpy, 0);

  return (
    <div style={fmStyles.wrap}>
      <div style={fmStyles.list}>
        <div style={fmStyles.listTabs}>
          <div onClick={() => { setKind('clients'); setSelId('c01'); }} style={{ ...fmStyles.listTab, ...(kind==='clients' ? fmStyles.listTabActive : {}) }}>クライアント ({window.CLIENTS.length})</div>
          <div onClick={() => { setKind('factories'); setSelId('f01'); }} style={{ ...fmStyles.listTab, ...(kind==='factories' ? fmStyles.listTabActive : {}) }}>工場 ({window.FACTORIES_DATA.length})</div>
        </div>
        <div style={fmStyles.listSearch}>
          <input style={fmStyles.searchInput} placeholder="検索…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {filtered.map(it => {
          const d = window.DEALS.filter(d => isCli ? d.client === it.id : d.factory === it.name);
          return (
            <div key={it.id} onClick={() => setSelId(it.id)}
                 style={{ ...fmStyles.listItem, ...(it.id === selId ? fmStyles.listItemActive : {}) }}>
              <div style={fmStyles.listName}>{isCli ? it.name : `${it.name} · ${it.city}`}</div>
              <div style={fmStyles.listMeta}>{isCli ? it.industry : it.specialties.join(' / ')}</div>
              <div style={fmStyles.listStat}>
                <span>{d.length}件</span>
                <span>{window.fmtJPY(d.reduce((s,x) => s + x.total_jpy, 0))}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={fmStyles.detail}>
        {sel && (
          <>
            <div style={fmStyles.detailHead}>
              <div style={fmStyles.detailLogo}>{(isCli ? sel.name : sel.name).charAt(0)}</div>
              <div style={{ flex:1 }}>
                <div style={fmStyles.detailName}>{sel.name}</div>
                <div style={fmStyles.detailMeta}>{isCli ? sel.industry : `${sel.city} · ${sel.country}`} · 取引開始 {sel.since}</div>
              </div>
              <button style={{ padding:'7px 14px', border:'1px solid #e0dfd9', borderRadius:6, background:'#fff', cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>編集</button>
            </div>

            <div style={fmStyles.twoCol}>
              <div>
                <div style={fmStyles.card}>
                  <div style={fmStyles.cardTitle}>連絡先 / 基本情報</div>
                  {isCli ? (
                    <>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>担当</div><div style={fmStyles.fieldVal}>{sel.contact}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>電話</div><div style={fmStyles.fieldVal}>{sel.phone}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>メール</div><div style={fmStyles.fieldVal}>{sel.email}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>住所</div><div style={fmStyles.fieldVal}>{sel.address}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>請求先</div><div style={fmStyles.fieldVal}>{sel.billing_to}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>登録番号</div><div style={fmStyles.fieldVal}>{sel.tax_id}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>支払条件</div><div style={fmStyles.fieldVal}>{sel.payment_terms}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>消費税率</div><div style={fmStyles.fieldVal}>{sel.tax_rate}%</div></div>
                    </>
                  ) : (
                    <>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>中国名</div><div style={fmStyles.fieldVal}>{sel.name_cn}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>担当</div><div style={fmStyles.fieldVal}>{sel.contact}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>電話</div><div style={fmStyles.fieldVal}>{sel.phone}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>メール</div><div style={fmStyles.fieldVal}>{sel.email}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>WeChat</div><div style={fmStyles.fieldVal}>{sel.wechat}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>住所</div><div style={fmStyles.fieldVal}>{sel.address}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>得意分野</div><div style={fmStyles.fieldVal}>{sel.specialties.join(' / ')}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>支払条件</div><div style={fmStyles.fieldVal}>{sel.payment}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>インコタームズ</div><div style={fmStyles.fieldVal}>{sel.incoterm}</div></div>
                      <div style={fmStyles.field}><div style={fmStyles.fieldKey}>標準納期</div><div style={fmStyles.fieldVal}>{sel.lead_time}</div></div>
                    </>
                  )}
                </div>

                <div style={fmStyles.card}>
                  <div style={fmStyles.cardTitle}>関連案件 ({sDeals.length})</div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                    <tbody>
                      {sDeals.map(d => {
                        const stat = window.STATUS[d.status];
                        return (
                          <tr key={d.id} style={{ borderBottom:'1px solid #f5f4f0', cursor:'pointer' }} onClick={() => onOpenDeal(d)}>
                            <td style={{ padding:'8px 6px', fontFamily:"'Fraunces', serif", color:'#888', fontSize:10 }}>{d.id}</td>
                            <td style={{ padding:'8px 6px', fontWeight:500 }}>{d.name}</td>
                            <td style={{ padding:'8px 6px', textAlign:'right', fontFamily:"'Fraunces', serif", fontWeight:500 }}>{window.fmtJPY(d.total_jpy)}</td>
                            <td style={{ padding:'8px 6px', textAlign:'center' }}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:9.5, fontFamily:"'Fraunces', serif" }}>
                                <span style={{ width:6, height:6, borderRadius:'50%', background:stat.dot }}></span>{stat.short}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div style={fmStyles.card}>
                  <div style={fmStyles.cardTitle}>サマリ</div>
                  <div style={{ fontFamily:"'Fraunces', serif", fontSize:24, fontWeight:600, letterSpacing:'-0.01em' }}>{window.fmtJPY(totalRev)}</div>
                  <div style={{ fontSize:10.5, color:'#888', marginTop:2, marginBottom:14 }}>累計取引額 ({sDeals.length}件)</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:11 }}>
                    <div><div style={{ color:'#888', fontSize:10 }}>進行中</div><div style={{ fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:14 }}>{sDeals.filter(d => d.status !== 'delivered').length}件</div></div>
                    <div><div style={{ color:'#888', fontSize:10 }}>完了</div><div style={{ fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:14 }}>{sDeals.filter(d => d.status === 'delivered').length}件</div></div>
                  </div>
                </div>
                {!isCli && (
                  <div style={fmStyles.card}>
                    <div style={fmStyles.cardTitle}>評価</div>
                    {[['品質', sel.stars.quality], ['納期', sel.stars.delivery], ['価格', sel.stars.price]].map(([k,v]) => (
                      <div key={k} style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 0', fontSize:11.5 }}>
                        <span style={{ width:50, color:'#888' }}>{k}</span>
                        <span style={{ color:'#e0a132', fontFamily:"'Fraunces', serif", fontSize:14, letterSpacing:1 }}>{'★'.repeat(v)}{'☆'.repeat(5-v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Docs hub view ---
function FinalDocsHub({ onCreateDoc }) {
  const grouped = React.useMemo(() => {
    const m = new Map();
    for (const d of window.DEALS) { if (!m.has(d.client)) m.set(d.client, []); m.get(d.client).push(d); }
    return m;
  }, []);
  return (
    <div style={{ flex:1, overflow:'auto', padding:'24px 28px', background:'#fff' }}>
      <div style={{ fontFamily:"'Fraunces', serif", fontSize:20, fontWeight:600, marginBottom:4 }}>帳票ハブ</div>
      <div style={{ fontSize:11.5, color:'#888', marginBottom:24 }}>クライアント別に複数選択して、見積書・請求書・納品書を一括生成できます。工場には見積依頼書（中国語/英語）を発行できます。</div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:28 }}>
        {[
          { key:'quotation', icon:'📋', name:'見積書', sub:'クライアント向け · JP', color:'#fafaf9' },
          { key:'invoice', icon:'💴', name:'請求書', sub:'インボイス制度対応 · JP', color:'#fafaf9' },
          { key:'delivery', icon:'📦', name:'納品書', sub:'JP · ロゴ入り', color:'#fafaf9' },
          { key:'po', icon:'🏭', name:'見積依頼書', sub:'工場向け · CN/EN', color:'#fafaf9' },
        ].map(t => (
          <div key={t.key} onClick={() => onCreateDoc(t.key)}
               style={{ padding:18, border:'1px solid #e8e8e6', borderRadius:10, background:t.color, cursor:'pointer' }}>
            <div style={{ fontSize:24, marginBottom:8, fontFamily:"'Fraunces', serif" }}>{t.icon}</div>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>{t.name}</div>
            <div style={{ fontSize:10.5, color:'#888' }}>{t.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily:"'Fraunces', serif", fontSize:13, fontWeight:600, color:'#888', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10 }}>クライアント別 採用案件</div>
      {[...grouped.entries()].map(([cid, ds]) => {
        const c = window.CLIENTS.find(x => x.id === cid);
        return (
          <div key={cid} style={{ border:'1px solid #e8e8e6', borderRadius:10, marginBottom:12, overflow:'hidden' }}>
            <div style={{ padding:'10px 16px', background:'#fafaf9', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ fontWeight:600, fontSize:12.5 }}>{c.name}</div>
              <div style={{ fontSize:9.5, color:'#888', fontFamily:"'Fraunces', serif" }}>{ds.length}件 · {window.fmtJPY(ds.reduce((s,d) => s + d.total_jpy, 0))}</div>
              <div style={{ flex:1 }}></div>
              <button style={{ padding:'5px 10px', fontSize:10.5, border:'1px solid #e0dfd9', borderRadius:5, background:'#fff', cursor:'pointer', fontFamily:'inherit' }}>選択した案件で 一括請求書</button>
            </div>
            <table style={{ width:'100%', fontSize:11, borderCollapse:'collapse' }}>
              <tbody>
                {ds.map(d => (
                  <tr key={d.id} style={{ borderBottom:'1px solid #f5f4f0' }}>
                    <td style={{ padding:'8px 12px', width:30 }}><input type="checkbox" defaultChecked /></td>
                    <td style={{ padding:'8px 6px', fontFamily:"'Fraunces', serif", color:'#888', fontSize:10 }}>{d.id}</td>
                    <td style={{ padding:'8px 6px', fontWeight:500 }}>{d.name}</td>
                    <td style={{ padding:'8px 6px', color:'#888', fontSize:10.5 }}>{d.qty.toLocaleString()}個</td>
                    <td style={{ padding:'8px 6px', textAlign:'right', fontFamily:"'Fraunces', serif", fontWeight:500 }}>{window.fmtJPY(d.total_jpy)}</td>
                    <td style={{ padding:'8px 6px', textAlign:'center', fontSize:9.5, fontFamily:"'Fraunces', serif", color:'#888' }}>{window.STATUS[d.status].short}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

window.FinalMaster = FinalMaster;
window.FinalDocsHub = FinalDocsHub;
