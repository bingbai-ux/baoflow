// Document Generator Modal — generates 発注書 (PO to factory) and 請求書 (Invoice to client)
// from the adopted variant. Shows live preview, lets user tweak fields, then export.

const dgStyles = {
  overlay: { position:'fixed', inset:0, background:'rgba(10,10,10,0.5)', backdropFilter:'blur(2px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:30, fontFamily:"'Zen Kaku Gothic New', sans-serif" },
  modal: { background:'#f2f2f0', borderRadius:16, width:'100%', maxWidth:1100, height:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,0.3)' },
  header: { padding:'14px 20px', background:'#fff', borderBottom:'1px solid #f0f0ee', display:'flex', alignItems:'center', justifyContent:'space-between' },
  title: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:16, color:'#0a0a0a' },
  tabs: { display:'flex', gap:2, background:'#f5f5f4', borderRadius:8, padding:3 },
  tab: { padding:'5px 14px', fontSize:12, borderRadius:6, border:'none', cursor:'pointer', background:'transparent', color:'#888', fontFamily:'inherit' },
  tabActive: { background:'#fff', color:'#0a0a0a', fontWeight:500, boxShadow:'0 1px 2px rgba(0,0,0,0.06)' },
  body: { display:'flex', flex:1, minHeight:0 },
  side: { width:300, padding:'16px 18px', overflowY:'auto', background:'#fff', borderRight:'1px solid #f0f0ee', display:'flex', flexDirection:'column', gap:14 },
  preview: { flex:1, overflowY:'auto', padding:30, background:'#e8e8e6', display:'flex', justifyContent:'center', alignItems:'flex-start' },
  paper: { background:'#fff', width:'100%', maxWidth:680, minHeight:880, padding:'48px 56px', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', fontSize:11, color:'#0a0a0a', lineHeight:1.6 },
  footer: { padding:'10px 20px', background:'#fff', borderTop:'1px solid #f0f0ee', display:'flex', justifyContent:'space-between', alignItems:'center' },
  label: { fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5, fontWeight:500 },
  input: { width:'100%', border:'1px solid #e8e8e6', borderRadius:5, padding:'6px 9px', fontSize:12, fontFamily:'inherit', outline:'none', background:'#fff' },
  field: { display:'flex', flexDirection:'column' },
  closeBtn: { width:28, height:28, borderRadius:6, background:'transparent', border:'none', cursor:'pointer', color:'#888', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' },
  // paper styles
  brand: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:24, color:'#0a0a0a', letterSpacing:'-0.01em' },
  docTitle: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:28, color:'#0a0a0a', textAlign:'center', borderBottom:'2px solid #0a0a0a', paddingBottom:10, marginBottom:30, letterSpacing:'0.1em' },
  metaRow: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:30 },
  partyBox: { fontSize:11 },
  partyName: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:14, marginBottom:4 },
  partyLine: { color:'#555', lineHeight:1.7 },
  metaList: { fontSize:10, lineHeight:1.9 },
  metaLabel: { color:'#888', display:'inline-block', minWidth:60 },
  table: { width:'100%', borderCollapse:'collapse', fontSize:11, marginTop:20, marginBottom:20 },
  th: { padding:'9px 8px', borderTop:'2px solid #0a0a0a', borderBottom:'1px solid #0a0a0a', textAlign:'left', fontWeight:500, fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'0.04em' },
  thNum: { textAlign:'right' },
  td: { padding:'10px 8px', borderBottom:'1px solid #e8e8e6', verticalAlign:'top' },
  tdNum: { textAlign:'right', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' },
  totalRow: { fontWeight:600, fontFamily:"'Fraunces', serif" },
  termsBox: { marginTop:20, padding:14, background:'#fafaf9', borderLeft:'2px solid #0a0a0a', fontSize:10, color:'#555', lineHeight:1.7 },
  stamp: { display:'flex', justifyContent:'flex-end', gap:30, marginTop:40 },
  stampBox: { width:90, height:90, border:'1px solid #d8d8d4', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'#bbb', fontSize:9, fontStyle:'italic' },
};

function DocGeneratorModal({ deal, type, onClose }) {
  const [docType, setDocType] = React.useState(type || 'invoice'); // 'invoice' | 'po'
  const adopted = deal.variants.find(v => v.note === 'メイン') || deal.variants[0];
  const [docNo, setDocNo] = React.useState(docType === 'invoice' ? `INV-2025-${String(Math.floor(Math.random()*900)+100)}` : `PO-2025-${String(Math.floor(Math.random()*900)+100)}`);
  const [issueDate, setIssueDate] = React.useState('2025-10-30');
  const [dueDate, setDueDate] = React.useState('2025-11-30');
  const [includeVariants, setIncludeVariants] = React.useState(false);

  React.useEffect(() => {
    setDocNo(docType === 'invoice' ? `INV-2025-${String(Math.floor(Math.random()*900)+100)}` : `PO-2025-${String(Math.floor(Math.random()*900)+100)}`);
  }, [docType]);

  const client = window.clientById(deal.client);
  const isInvoice = docType === 'invoice';
  const subtotal = adopted.total_jpy;
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;

  // PO is in USD to factory
  const poSubtotal = Math.round(adopted.qty * adopted.unit_usd * 100) / 100;
  const poDeposit = Math.round(poSubtotal * 0.5 * 100) / 100;

  return (
    <div style={dgStyles.overlay} onClick={onClose}>
      <div style={dgStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={dgStyles.header}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={dgStyles.title}>書類を生成</div>
            <span style={{ fontSize:11, color:'#888', fontFamily:"'Fraunces', serif" }}>{deal.id} · {deal.name}</span>
          </div>
          <div style={dgStyles.tabs}>
            <button onClick={() => setDocType('invoice')} style={{ ...dgStyles.tab, ...(isInvoice ? dgStyles.tabActive : {}) }}>💴 請求書 (クライアント宛)</button>
            <button onClick={() => setDocType('po')} style={{ ...dgStyles.tab, ...(!isInvoice ? dgStyles.tabActive : {}) }}>📄 発注書 (工場宛)</button>
          </div>
          <button style={dgStyles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={dgStyles.body}>
          {/* Sidebar — editable fields */}
          <div style={dgStyles.side}>
            <div style={{ fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:13, color:'#0a0a0a' }}>書類情報</div>

            <div style={dgStyles.field}>
              <div style={dgStyles.label}>書類番号</div>
              <input value={docNo} onChange={e => setDocNo(e.target.value)} style={dgStyles.input} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={dgStyles.field}>
                <div style={dgStyles.label}>発行日</div>
                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={{ ...dgStyles.input, fontFamily:"'Fraunces', serif" }} />
              </div>
              <div style={dgStyles.field}>
                <div style={dgStyles.label}>{isInvoice ? '支払期限' : '納期'}</div>
                <input type="date" value={isInvoice ? dueDate : deal.delivery} onChange={e => setDueDate(e.target.value)} style={{ ...dgStyles.input, fontFamily:"'Fraunces', serif" }} />
              </div>
            </div>

            <div style={{ borderTop:'1px solid #f0f0ee', paddingTop:12 }}>
              <div style={{ fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:13, color:'#0a0a0a', marginBottom:8 }}>採用バリエーション</div>
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:6, padding:10, fontSize:11 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ color:'#15803d', fontWeight:500 }}>● {adopted.note}</span>
                  <span style={{ color:'#888', fontFamily:"'Fraunces', serif" }}>{adopted.version}</span>
                </div>
                <div style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', color:'#0a0a0a' }}>
                  {adopted.qty.toLocaleString()} 個 × {window.fmtUSDsmall(adopted.unit_usd)}
                </div>
                <div style={{ marginTop:6, fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:13, fontWeight:600 }}>
                  {isInvoice ? window.fmtJPY(adopted.total_jpy) : `$${poSubtotal.toLocaleString('en-US')}`}
                </div>
              </div>
              <button style={{ marginTop:8, background:'transparent', border:'1px dashed #d8d8d4', borderRadius:5, padding:'5px 10px', fontSize:11, cursor:'pointer', color:'#555', fontFamily:'inherit', width:'100%' }}>採用バリエーションを変更</button>
            </div>

            <div style={{ borderTop:'1px solid #f0f0ee', paddingTop:12 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, cursor:'pointer' }}>
                <input type="checkbox" checked={includeVariants} onChange={e => setIncludeVariants(e.target.checked)} />
                <span>他のバリエーションも参考価格として記載</span>
              </label>
            </div>

            <div style={{ borderTop:'1px solid #f0f0ee', paddingTop:12 }}>
              <div style={{ fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:13, color:'#0a0a0a', marginBottom:8 }}>備考・特記事項</div>
              <textarea defaultValue={isInvoice ? '・お振込み手数料はご負担ください。\n・納期は出荷時期目安です。' : '・品質基準は別添仕様書に準ずる。\n・梱包: ダンボール 1c/100pcs。'} style={{ ...dgStyles.input, minHeight:80, resize:'vertical', fontSize:11 }} />
            </div>
          </div>

          {/* Live preview */}
          <div style={dgStyles.preview}>
            <div style={dgStyles.paper}>
              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:30 }}>
                <div style={dgStyles.brand}>BAOFlow</div>
                <div style={{ textAlign:'right', fontSize:9, color:'#888', lineHeight:1.7 }}>
                  株式会社フード&カンパニー<br/>
                  〒106-0032 東京都港区六本木1-2-3<br/>
                  TEL 03-0000-0000 / 登録番号 T1234567890123
                </div>
              </div>

              <div style={dgStyles.docTitle}>{isInvoice ? '請　求　書' : 'PURCHASE ORDER'}</div>

              {/* Meta */}
              <div style={dgStyles.metaRow}>
                <div style={dgStyles.partyBox}>
                  <div style={{ fontSize:10, color:'#888', marginBottom:4 }}>{isInvoice ? '請求先' : 'TO'}</div>
                  <div style={dgStyles.partyName}>{isInvoice ? client.name : deal.factory}</div>
                  <div style={dgStyles.partyLine}>
                    {isInvoice ? '担当: 山田 太郎 様' : 'Attn: Mr. Wang'}<br/>
                    {isInvoice ? 'sales@example.co.jp' : 'wang@factory.cn'}
                  </div>
                  <div style={{ marginTop:14, fontSize:11, lineHeight:1.7 }}>
                    {isInvoice ? '下記の通り、ご請求申し上げます。' : 'Please ship the items below as ordered.'}
                  </div>
                </div>
                <div style={dgStyles.metaList}>
                  <div><span style={dgStyles.metaLabel}>{isInvoice ? '請求番号' : 'PO No.'}</span> <span style={{ fontFamily:"'Fraunces', serif" }}>{docNo}</span></div>
                  <div><span style={dgStyles.metaLabel}>{isInvoice ? '発行日' : 'Issued'}</span> <span style={{ fontFamily:"'Fraunces', serif" }}>{window.fmtDateLong(issueDate)}</span></div>
                  <div><span style={dgStyles.metaLabel}>{isInvoice ? '支払期限' : 'Delivery'}</span> <span style={{ fontFamily:"'Fraunces', serif" }}>{window.fmtDateLong(isInvoice ? dueDate : deal.delivery)}</span></div>
                  <div><span style={dgStyles.metaLabel}>案件ID</span> <span style={{ fontFamily:"'Fraunces', serif" }}>{deal.id}</span></div>
                  {isInvoice && <div style={{ marginTop:10, padding:'7px 10px', background:'#0a0a0a', color:'#fff', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:14, fontWeight:600, textAlign:'center' }}>合計 {window.fmtJPY(total)}</div>}
                  {!isInvoice && <div style={{ marginTop:10, padding:'7px 10px', background:'#0a0a0a', color:'#fff', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:14, fontWeight:600, textAlign:'center' }}>${poSubtotal.toLocaleString('en-US')}</div>}
                </div>
              </div>

              {/* Items table */}
              <table style={dgStyles.table}>
                <thead>
                  <tr>
                    <th style={dgStyles.th}>{isInvoice ? '品目' : 'Item'}</th>
                    <th style={{ ...dgStyles.th, ...dgStyles.thNum, width:60 }}>{isInvoice ? '数量' : 'Qty'}</th>
                    <th style={{ ...dgStyles.th, ...dgStyles.thNum, width:90 }}>{isInvoice ? '単価' : 'Unit Price'}</th>
                    <th style={{ ...dgStyles.th, ...dgStyles.thNum, width:110 }}>{isInvoice ? '金額' : 'Amount'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={dgStyles.td}>
                      <div style={{ fontWeight:500 }}>{deal.name}</div>
                      <div style={{ fontSize:10, color:'#888', marginTop:3 }}>{deal.spec}</div>
                    </td>
                    <td style={{ ...dgStyles.td, ...dgStyles.tdNum }}>{adopted.qty.toLocaleString()}</td>
                    <td style={{ ...dgStyles.td, ...dgStyles.tdNum }}>{isInvoice ? window.fmtJPY(Math.round(adopted.total_jpy / adopted.qty)) : window.fmtUSDsmall(adopted.unit_usd)}</td>
                    <td style={{ ...dgStyles.td, ...dgStyles.tdNum, fontWeight:500 }}>{isInvoice ? window.fmtJPY(adopted.total_jpy) : `$${poSubtotal.toLocaleString('en-US')}`}</td>
                  </tr>
                  {includeVariants && deal.variants.filter(v => v.note !== adopted.note).map((v, i) => (
                    <tr key={i} style={{ background:'#fafaf9' }}>
                      <td style={{ ...dgStyles.td, color:'#888', fontStyle:'italic', fontSize:10 }}>(参考) {v.note}</td>
                      <td style={{ ...dgStyles.td, ...dgStyles.tdNum, color:'#888' }}>{v.qty.toLocaleString()}</td>
                      <td style={{ ...dgStyles.td, ...dgStyles.tdNum, color:'#888' }}>{isInvoice ? window.fmtJPY(Math.round(v.total_jpy / v.qty)) : window.fmtUSDsmall(v.unit_usd)}</td>
                      <td style={{ ...dgStyles.td, ...dgStyles.tdNum, color:'#888' }}>{isInvoice ? window.fmtJPY(v.total_jpy) : `$${(Math.round(v.qty * v.unit_usd * 100) / 100).toLocaleString('en-US')}`}</td>
                    </tr>
                  ))}
                  {/* Totals */}
                  <tr>
                    <td colSpan={3} style={{ ...dgStyles.td, textAlign:'right', color:'#888', borderBottom:'none' }}>{isInvoice ? '小計' : 'Subtotal'}</td>
                    <td style={{ ...dgStyles.td, ...dgStyles.tdNum, borderBottom:'none' }}>{isInvoice ? window.fmtJPY(subtotal) : `$${poSubtotal.toLocaleString('en-US')}`}</td>
                  </tr>
                  {isInvoice && (
                    <tr>
                      <td colSpan={3} style={{ ...dgStyles.td, textAlign:'right', color:'#888', borderBottom:'none' }}>消費税 (10%)</td>
                      <td style={{ ...dgStyles.td, ...dgStyles.tdNum, borderBottom:'none' }}>{window.fmtJPY(tax)}</td>
                    </tr>
                  )}
                  {!isInvoice && (
                    <tr>
                      <td colSpan={3} style={{ ...dgStyles.td, textAlign:'right', color:'#888', borderBottom:'none' }}>Deposit (50%)</td>
                      <td style={{ ...dgStyles.td, ...dgStyles.tdNum, borderBottom:'none' }}>${poDeposit.toLocaleString('en-US')}</td>
                    </tr>
                  )}
                  <tr style={dgStyles.totalRow}>
                    <td colSpan={3} style={{ ...dgStyles.td, textAlign:'right', borderTop:'1px solid #0a0a0a', borderBottom:'2px solid #0a0a0a', paddingTop:12, paddingBottom:12 }}>{isInvoice ? '合計' : 'TOTAL'}</td>
                    <td style={{ ...dgStyles.td, ...dgStyles.tdNum, borderTop:'1px solid #0a0a0a', borderBottom:'2px solid #0a0a0a', paddingTop:12, paddingBottom:12, fontSize:13 }}>{isInvoice ? window.fmtJPY(total) : `$${poSubtotal.toLocaleString('en-US')}`}</td>
                  </tr>
                </tbody>
              </table>

              {/* Payment info / shipping */}
              <div style={dgStyles.termsBox}>
                {isInvoice ? (
                  <>
                    <div style={{ fontWeight:500, color:'#0a0a0a', marginBottom:6 }}>お振込先</div>
                    <div>みずほ銀行 六本木支店 普通 1234567</div>
                    <div>カ）フードアンドカンパニー</div>
                    <div style={{ marginTop:8 }}>・お振込み手数料はご負担ください。</div>
                    <div>・納期は出荷時期目安です。</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight:500, color:'#0a0a0a', marginBottom:6 }}>Payment Terms</div>
                    <div>50% deposit upon order confirmation.</div>
                    <div>50% balance before shipment.</div>
                    <div style={{ marginTop:8 }}>・Quality must conform to the attached spec sheet.</div>
                    <div>・Packaging: 100pcs / carton.</div>
                  </>
                )}
              </div>

              <div style={dgStyles.stamp}>
                <div style={dgStyles.stampBox}>印</div>
              </div>
            </div>
          </div>
        </div>

        <div style={dgStyles.footer}>
          <div style={{ fontSize:10, color:'#bbb' }}>
            自動生成 · 採用バリエーション「{adopted.note}」から
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ background:'transparent', color:'#555', border:'1px solid #e8e8e6', borderRadius:6, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>キャンセル</button>
            <button style={{ background:'#fff', color:'#555', border:'1px solid #e8e8e6', borderRadius:6, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>📥 PDFダウンロード</button>
            <button style={{ background:'#0a0a0a', color:'#fff', border:'none', borderRadius:6, padding:'7px 18px', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>✉️ メールで送信</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.DocGeneratorModal = DocGeneratorModal;
