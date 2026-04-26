// Print / PDF documents — Minimal style only
// Types:   見積書 / 請求書 / 納品書 / 見積依頼書 (Quotation Request, CN/EN to factory)
// Flow:    案件選択 (クライアント別グループ + チェックボックス, 複数選択で一括請求) → プレビュー → 印刷
// Preview is inline-editable: every text node is contentEditable, edits persist in component state.

const printStyles = {
  // outer shell
  shell: {
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
    color:'#0a0a0a',
    background:'#f2f2f0',
    height:'100%',
    display:'flex', flexDirection:'column',
  },
  toolbar: {
    background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.06)',
    padding:'10px 14px', display:'flex', alignItems:'center', gap:14,
  },
  step: (active, done) => ({
    display:'flex', alignItems:'center', gap:7, fontSize:11,
    color: active ? '#0a0a0a' : done ? '#888' : '#bbb',
  }),
  stepNum: (active, done) => ({
    width:18, height:18, borderRadius:'50%',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:10, fontFamily:"'Fraunces', serif",
    background: active ? '#0a0a0a' : done ? '#0a0a0a' : '#e8e8e6',
    color: active || done ? '#fff' : '#888',
    fontVariantNumeric:'tabular-nums',
  }),
  stepDiv: { width:24, height:1, background:'#ddd' },
  printBtn: {
    background:'#0a0a0a', color:'#fff', border:'none',
    padding:'7px 14px', fontSize:11, borderRadius:6, cursor:'pointer',
    display:'inline-flex', alignItems:'center', gap:6,
  },
  printBtnDis: {
    background:'#e8e8e6', color:'#888', border:'none',
    padding:'7px 14px', fontSize:11, borderRadius:6, cursor:'not-allowed',
    display:'inline-flex', alignItems:'center', gap:6,
  },
  segLine: {
    display:'flex', background:'#fff', borderRadius:6,
    border:'1px solid rgba(0,0,0,0.06)', overflow:'hidden', fontSize:10,
  },
  segItem: (active) => ({
    padding:'5px 10px', cursor:'pointer',
    background: active ? '#0a0a0a' : '#fff',
    color: active ? '#fff' : '#666',
  }),

  // === Step 1: deal picker, grouped by client + checkboxes ===
  pickWrap: {
    flex:1, overflowY:'auto', padding:'14px 18px',
  },
  pickIntro: {
    background:'#fff', borderRadius:10, padding:'12px 14px',
    border:'1px solid rgba(0,0,0,0.06)', marginBottom:14,
    display:'flex', alignItems:'center', justifyContent:'space-between',
  },
  pickIntroTitle: { fontFamily:"'Fraunces', serif", fontSize:13, fontWeight:600 },
  pickIntroSub: { fontSize:11, color:'#888', marginTop:2 },
  pickActions: { display:'flex', gap:8, alignItems:'center' },
  selBadge: {
    background:'#0a0a0a', color:'#fff', borderRadius:12, padding:'4px 10px',
    fontSize:10, fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
  },
  bulkNotice: {
    fontSize:10, color:'#cf5a3a', display:'flex', alignItems:'center', gap:5,
  },
  ghostBtn: {
    background:'#fafaf9', color:'#0a0a0a',
    border:'1px solid rgba(0,0,0,0.08)',
    padding:'6px 11px', fontSize:11, borderRadius:6, cursor:'pointer',
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
  },

  // grouped table
  groupCard: {
    background:'#fff', borderRadius:12,
    border:'1px solid rgba(0,0,0,0.06)',
    marginBottom:10, overflow:'hidden',
  },
  groupHead: {
    display:'grid',
    gridTemplateColumns:'24px 220px 1fr 90px 100px 90px',
    gap:10, alignItems:'center',
    padding:'10px 14px',
    background:'#fafaf9',
    borderBottom:'1px solid rgba(0,0,0,0.06)',
    fontSize:11,
    cursor:'pointer',
  },
  groupName: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:13 },
  groupMeta: { fontSize:10, color:'#888', marginTop:1 },
  rollupNum: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:11, textAlign:'right',
  },
  rollupSub: { fontSize:9, color:'#888', textAlign:'right' },

  dealRow: (selected) => ({
    display:'grid',
    gridTemplateColumns:'24px 220px 1fr 90px 100px 90px',
    gap:10, alignItems:'center',
    padding:'9px 14px',
    fontSize:11, lineHeight:1.3,
    borderBottom:'1px solid rgba(0,0,0,0.04)',
    background: selected ? '#f4f4f1' : '#fff',
    cursor:'pointer',
  }),
  cb: (checked, indeterminate) => ({
    width:14, height:14, borderRadius:3,
    border: checked || indeterminate ? '1px solid #0a0a0a' : '1px solid #ccc',
    background: checked || indeterminate ? '#0a0a0a' : '#fff',
    display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0,
  }),

  // === Step 2: preview ===
  previewWrap: {
    flex:1, overflow:'auto', padding:24,
    display:'flex', flexDirection:'column', alignItems:'center', gap:24,
    background:'#e6e6e0',
  },
  page: {
    width: 794, minHeight: 1123,
    background:'#fff',
    boxShadow:'0 4px 24px rgba(0,0,0,0.08)',
    padding:'56px 60px 60px',
    color:'#0a0a0a',
    fontFamily:"'Zen Kaku Gothic New', sans-serif",
    fontSize:11.5, lineHeight:1.65,
    boxSizing:'border-box',
    position:'relative',
    flexShrink:0,
  },
  pageOf: {
    position:'absolute', top:14, right:18,
    fontSize:9, color:'#bbb',
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
  },
};

// === Editable text node — small wrapper around contentEditable ===
function Editable({ value, onChange, style, multiline = false, placeholder = '' }) {
  const ref = React.useRef(null);
  const isComposing = React.useRef(false);

  // Sync when external value changes (e.g. after switching docs)
  React.useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value || '';
    }
  }, [value]);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={(e) => {
        isComposing.current = false;
        onChange(e.currentTarget.innerText);
      }}
      onInput={(e) => {
        if (!isComposing.current) onChange(e.currentTarget.innerText);
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') e.preventDefault();
      }}
      onBlur={(e) => onChange(e.currentTarget.innerText)}
      style={{
        outline:'none',
        minWidth:8,
        whiteSpace: multiline ? 'pre-wrap' : 'pre',
        borderRadius:2,
        cursor:'text',
        ...style,
      }}
      data-placeholder={placeholder}
    />
  );
}

// === editable styles for the print page (only show in non-print mode) ===
const editableHover = `
  [data-editable]:hover { background: rgba(252, 211, 77, 0.18); }
  [data-editable]:focus { background: rgba(252, 211, 77, 0.28); outline: 1px dashed rgba(0,0,0,0.25); outline-offset: 1px; }
  @media print {
    [data-editable]:hover, [data-editable]:focus { background: transparent !important; outline: none !important; }
    .no-print { display: none !important; }
  }
`;

// === SENDER (BAOFlow) — also editable later if desired ===
const SENDER = {
  name_jp: '株式会社 BAOFlow',
  name_en: 'BAOFlow Co., Ltd.',
  address_jp: '〒150-0042 東京都渋谷区宇田川町20-15 渋谷PARCO 5F',
  address_en: '5F Shibuya PARCO, 20-15 Udagawa-cho, Shibuya-ku, Tokyo 150-0042 JAPAN',
  phone: '03-6427-9080',
  email: 'info@baoflow.jp',
  bank_jp: 'みずほ銀行 渋谷支店  普通 1234567  カ）バオフロウ',
  registration: '登録番号 T1010001234567',
};

// === Helper formatters ===
const jpyAmount = (n) => '¥' + (n || 0).toLocaleString('ja-JP');

// === Build line item from a deal ===
function dealToLine(deal, idx) {
  return {
    no: idx + 1,
    name: deal.name,
    spec: deal.spec,
    qty: deal.qty,
    unit: '個',
    unit_price: Math.round(deal.total_jpy / deal.qty),
    amount: deal.total_jpy,
    note: `Ver ${deal.version} · ${deal.id}`,
    deal_id: deal.id,
  };
}

// ───────────────────────────────────────────────────────────
// Editable doc styles (minimal)
// ───────────────────────────────────────────────────────────
const ds = {
  brand: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:13, letterSpacing:'-0.01em' },
  brandSub: { fontSize:9, color:'#888', marginTop:2 },
  docNo: { fontSize:9, color:'#888', textAlign:'right' },
  title: {
    fontFamily:"'Fraunces', serif", fontWeight:500,
    fontSize:32, letterSpacing:'0.4em', textAlign:'center',
    margin:'40px 0 6px',
  },
  titleEn: {
    fontFamily:"'Fraunces', serif", fontStyle:'italic',
    fontSize:11, color:'#888', textAlign:'center', marginBottom:32,
    letterSpacing:'0.1em',
  },
  hRow: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:30 },
  recipName: {
    fontFamily:"'Fraunces', serif", fontSize:18, fontWeight:500,
    marginBottom:6, paddingBottom:6, borderBottom:'1px solid #0a0a0a',
  },
  recipMeta: { fontSize:10, color:'#555', lineHeight:1.7 },
  meta: { fontSize:10, lineHeight:1.7 },
  metaLabel: { color:'#888', display:'inline-block', minWidth:60 },
  totalBlock: {
    margin:'28px 0', padding:'18px 22px',
    border:'1px solid #0a0a0a', borderLeft:'4px solid #0a0a0a',
    display:'flex', alignItems:'baseline', justifyContent:'space-between',
  },
  totalLabel: { fontFamily:"'Fraunces', serif", fontSize:14, letterSpacing:'0.1em' },
  totalAmt: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    fontSize:28, fontWeight:500,
  },
  table: { width:'100%', borderCollapse:'collapse', marginTop:18, fontSize:11 },
  th: {
    fontFamily:"'Zen Kaku Gothic New', sans-serif", fontWeight:500,
    fontSize:9, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em',
    padding:'8px 6px', textAlign:'left',
    borderBottom:'1px solid #0a0a0a',
  },
  td: {
    padding:'10px 6px', borderBottom:'1px solid rgba(0,0,0,0.08)',
    verticalAlign:'top',
  },
  tdNum: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums',
    textAlign:'right',
  },
  sumRow: { display:'flex', justifyContent:'flex-end', marginTop:18 },
  sumGrid: {
    display:'grid', gridTemplateColumns:'auto auto', columnGap:30, rowGap:6,
    fontSize:11, minWidth:280,
  },
  sumLabel: { color:'#888' },
  sumVal: {
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', textAlign:'right',
  },
  sumTotal: {
    paddingTop:8, marginTop:4, borderTop:'1px solid #0a0a0a',
    fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', textAlign:'right',
    fontSize:15, fontWeight:600,
  },
  notes: {
    marginTop:36, paddingTop:18, borderTop:'1px solid rgba(0,0,0,0.1)',
    fontSize:10, color:'#555', lineHeight:1.8,
  },
  notesH: { fontSize:9, color:'#888', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 },
  stamp: { marginTop:20, display:'flex', justifyContent:'flex-end' },
  stampBox: {
    fontSize:9, color:'#888', fontFamily:"'Fraunces', serif",
    letterSpacing:'0.08em', borderTop:'1px solid rgba(0,0,0,0.2)',
    paddingTop:6, paddingLeft:30, paddingRight:30,
    textAlign:'center',
  },
};

// === Field helper that wraps Editable with a green-yellow hover hint ===
function EF({ value, onChange, style, multiline, placeholder }) {
  return (
    <Editable
      value={value} onChange={onChange}
      style={{ display:'inline-block', ...(style || {}) }}
      multiline={multiline}
      placeholder={placeholder}
    />
  );
}
function EFblock({ value, onChange, style, multiline = true }) {
  return <span data-editable style={{ display:'block' }}><EF value={value} onChange={onChange} style={style} multiline={multiline} /></span>;
}
function EFinline({ value, onChange, style, multiline = false }) {
  return <span data-editable style={{ display:'inline-block' }}><EF value={value} onChange={onChange} style={style} multiline={multiline} /></span>;
}

// ───────────────────────────────────────────────────────────
// Editable doc — Quote (見積書) / Invoice (請求書) / Delivery (納品書)
// (combined component, varies title + summary line)
// ───────────────────────────────────────────────────────────
function JPDoc({ kind, draft, setDraft, pageNo = 1, pageOf = 1 }) {
  const isInvoice = kind === 'invoice';
  const isQuote = kind === 'quote';
  const isDelivery = kind === 'delivery';

  const titleJp = isInvoice ? '請 求 書' : isQuote ? '御 見 積 書' : '納 品 書';
  const titleEn = isInvoice ? 'Invoice' : isQuote ? 'Quotation' : 'Delivery Note';
  const docPrefix = isInvoice ? 'INV-' : isQuote ? 'EST-' : 'DLV-';

  // totals (computed live from draft.lines for invoice/quote)
  const subtotal = draft.lines.reduce((s, it) => s + (it.amount || 0), 0);
  const taxRate = draft.taxRate ?? 10;
  const tax = isDelivery ? 0 : Math.round(subtotal * (taxRate / 100));
  const total = subtotal + tax;

  // helpers to mutate a single line's field
  const setLine = (idx, key, val) => {
    setDraft(d => {
      const lines = d.lines.map((l, i) => i === idx ? { ...l, [key]: val } : l);
      return { ...d, lines };
    });
  };
  const setLineNum = (idx, key, val) => {
    const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
    setLine(idx, key, isNaN(num) ? 0 : num);
    if (key === 'qty' || key === 'unit_price') {
      setDraft(d => {
        const lines = d.lines.map((l, i) => {
          if (i !== idx) return l;
          const updated = { ...l, [key]: isNaN(num) ? 0 : num };
          updated.amount = (updated.qty || 0) * (updated.unit_price || 0);
          return updated;
        });
        return { ...d, lines };
      });
    }
  };

  const addLine = () => {
    setDraft(d => ({
      ...d,
      lines: [...d.lines, {
        no: d.lines.length + 1,
        name: '', spec: '', qty: 0, unit:'個', unit_price: 0, amount: 0, note:'',
      }],
    }));
  };
  const removeLine = (idx) => {
    setDraft(d => ({ ...d, lines: d.lines.filter((_, i) => i !== idx).map((l, i) => ({ ...l, no: i + 1 })) }));
  };

  // padding rows so the table has visual presence even with 1-2 lines
  const minRows = 4;
  const padCount = Math.max(0, minRows - draft.lines.length);

  return (
    <div style={printStyles.page}>
      {pageOf > 1 && <div style={printStyles.pageOf}>p. {pageNo} / {pageOf}</div>}

      {/* head */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={ds.brand}><EFinline value={draft.senderName} onChange={v => setDraft(d => ({ ...d, senderName: v }))} /></div>
          <div style={ds.brandSub}><EFinline value={draft.senderAddr} onChange={v => setDraft(d => ({ ...d, senderAddr: v }))} multiline /></div>
          <div style={ds.brandSub}>TEL <EFinline value={draft.senderPhone} onChange={v => setDraft(d => ({ ...d, senderPhone: v }))} />  ·  <EFinline value={draft.senderEmail} onChange={v => setDraft(d => ({ ...d, senderEmail: v }))} /></div>
          <div style={ds.brandSub}><EFinline value={draft.senderRegistration} onChange={v => setDraft(d => ({ ...d, senderRegistration: v }))} /></div>
        </div>
        <div style={ds.docNo}>
          <div style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:11, color:'#0a0a0a' }}>
            {docPrefix}<EFinline value={draft.docNo} onChange={v => setDraft(d => ({ ...d, docNo: v }))} />
          </div>
          <div style={{ marginTop:2 }}>{isInvoice ? 'お支払期限' : isQuote ? '有効期限' : '納品日'} <EFinline value={draft.dateMain} onChange={v => setDraft(d => ({ ...d, dateMain: v }))} /></div>
          <div>発行日 <EFinline value={draft.dateIssued} onChange={v => setDraft(d => ({ ...d, dateIssued: v }))} /></div>
        </div>
      </div>

      <div style={ds.title}>{titleJp}</div>
      <div style={ds.titleEn}>{titleEn}</div>

      <div style={ds.hRow}>
        <div>
          <div style={ds.recipName}><EFinline value={draft.recipName} onChange={v => setDraft(d => ({ ...d, recipName: v }))} /> 御中</div>
          <div style={ds.recipMeta}>
            <EFblock value={draft.recipBilling} onChange={v => setDraft(d => ({ ...d, recipBilling: v }))} multiline />
            <EFblock value={draft.recipAddress} onChange={v => setDraft(d => ({ ...d, recipAddress: v }))} multiline />
          </div>
        </div>
        <div>
          <div style={{ ...ds.meta, marginTop:24 }}>
            <EFblock value={draft.intro} onChange={v => setDraft(d => ({ ...d, intro: v }))} multiline />
          </div>
        </div>
      </div>

      {!isDelivery && (
        <div style={ds.totalBlock}>
          <div style={ds.totalLabel}>{isInvoice ? '御請求金額（税込）' : '御見積金額（税込）'}</div>
          <div style={ds.totalAmt}>{jpyAmount(total)}</div>
        </div>
      )}

      <table style={ds.table}>
        <thead>
          <tr>
            <th style={{ ...ds.th, width:24 }}>No.</th>
            <th style={ds.th}>品名 / 仕様</th>
            <th style={{ ...ds.th, width:80, textAlign:'right' }}>数量</th>
            {!isDelivery && <th style={{ ...ds.th, width:80, textAlign:'right' }}>単価</th>}
            {!isDelivery && <th style={{ ...ds.th, width:90, textAlign:'right' }}>金額</th>}
            {isDelivery && <th style={{ ...ds.th, width:90, textAlign:'right' }}>備考</th>}
            <th className="no-print" style={{ ...ds.th, width:24 }}></th>
          </tr>
        </thead>
        <tbody>
          {draft.lines.map((it, idx) => (
            <tr key={idx}>
              <td style={{ ...ds.td, ...ds.tdNum }}>{idx + 1}</td>
              <td style={ds.td}>
                <div style={{ fontWeight:500 }}><EFinline value={it.name} onChange={v => setLine(idx, 'name', v)} /></div>
                <div style={{ fontSize:10, color:'#555', marginTop:2 }}><EFinline value={it.spec} onChange={v => setLine(idx, 'spec', v)} multiline /></div>
                {it.note && <div style={{ fontSize:9, color:'#888', marginTop:2 }}><EFinline value={it.note} onChange={v => setLine(idx, 'note', v)} /></div>}
              </td>
              <td style={{ ...ds.td, ...ds.tdNum }}>
                <EFinline value={(it.qty || 0).toLocaleString()} onChange={v => setLineNum(idx, 'qty', v)} /> {it.unit}
              </td>
              {!isDelivery && (
                <td style={{ ...ds.td, ...ds.tdNum }}>
                  ¥<EFinline value={(it.unit_price || 0).toLocaleString()} onChange={v => setLineNum(idx, 'unit_price', v)} />
                </td>
              )}
              {!isDelivery && (
                <td style={{ ...ds.td, ...ds.tdNum }}>{jpyAmount(it.amount)}</td>
              )}
              {isDelivery && (
                <td style={{ ...ds.td, fontSize:10, color:'#555' }}>
                  <EFinline value={it.note || ''} onChange={v => setLine(idx, 'note', v)} />
                </td>
              )}
              <td className="no-print" style={{ ...ds.td, textAlign:'center', verticalAlign:'middle' }}>
                <span onClick={() => removeLine(idx)} style={{ cursor:'pointer', color:'#bbb', fontSize:11 }} title="行を削除">✕</span>
              </td>
            </tr>
          ))}
          {[...Array(padCount)].map((_, i) => (
            <tr key={'pad'+i}>
              <td style={ds.td}>&nbsp;</td>
              <td style={ds.td}>&nbsp;</td>
              <td style={ds.td}>&nbsp;</td>
              {!isDelivery && <td style={ds.td}>&nbsp;</td>}
              <td style={ds.td}>&nbsp;</td>
              <td className="no-print" style={ds.td}></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="no-print" style={{ marginTop:8, textAlign:'right' }}>
        <span onClick={addLine} style={{ fontSize:10, color:'#888', cursor:'pointer', borderBottom:'1px dashed #888' }}>+ 行を追加</span>
      </div>

      {!isDelivery && (
        <div style={ds.sumRow}>
          <div style={ds.sumGrid}>
            <div style={ds.sumLabel}>小計</div>
            <div style={ds.sumVal}>{jpyAmount(subtotal)}</div>
            <div style={ds.sumLabel}>消費税 (<EFinline value={String(taxRate)} onChange={v => {
              const n = parseFloat(v); if (!isNaN(n)) setDraft(d => ({ ...d, taxRate: n }));
            }} />%)</div>
            <div style={ds.sumVal}>{jpyAmount(tax)}</div>
            <div style={ds.sumTotal}></div>
            <div style={ds.sumTotal}>{jpyAmount(total)}</div>
          </div>
        </div>
      )}

      <div style={ds.notes}>
        <div style={ds.notesH}>{isInvoice ? 'お振込先 / 備考' : '備考'}</div>
        <EFblock value={draft.notes} onChange={v => setDraft(d => ({ ...d, notes: v }))} multiline />
      </div>

      <div style={ds.stamp}>
        <div style={ds.stampBox}>
          <div>ELECTRONICALLY ISSUED</div>
          <div style={{ marginTop:3 }}><EFinline value={draft.dateIssued} onChange={v => setDraft(d => ({ ...d, dateIssued: v }))} /> · BAOFlow</div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Quotation Request (見積依頼書) — bilingual CN/EN, no money totals
// ───────────────────────────────────────────────────────────
function QuotationRequestDoc({ draft, setDraft }) {
  const setLine = (idx, key, val) => {
    setDraft(d => {
      const lines = d.lines.map((l, i) => i === idx ? { ...l, [key]: val } : l);
      return { ...d, lines };
    });
  };
  const setLineNum = (idx, key, val) => {
    const num = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
    setLine(idx, key, isNaN(num) ? 0 : num);
  };
  const addLine = () => {
    setDraft(d => ({
      ...d,
      lines: [...d.lines, { no: d.lines.length + 1, name: '', spec: '', qty: 0, unit:'pcs', target_price:'', note:'' }],
    }));
  };
  const removeLine = (idx) => {
    setDraft(d => ({ ...d, lines: d.lines.filter((_, i) => i !== idx).map((l, i) => ({ ...l, no: i + 1 })) }));
  };
  const minRows = 3;
  const padCount = Math.max(0, minRows - draft.lines.length);

  return (
    <div style={printStyles.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={ds.brand}><EFinline value={draft.senderName} onChange={v => setDraft(d => ({ ...d, senderName: v }))} /></div>
          <div style={ds.brandSub}><EFinline value={draft.senderAddr} onChange={v => setDraft(d => ({ ...d, senderAddr: v }))} multiline /></div>
          <div style={ds.brandSub}>TEL <EFinline value={draft.senderPhone} onChange={v => setDraft(d => ({ ...d, senderPhone: v }))} />  ·  <EFinline value={draft.senderEmail} onChange={v => setDraft(d => ({ ...d, senderEmail: v }))} /></div>
        </div>
        <div style={ds.docNo}>
          <div style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', fontSize:11, color:'#0a0a0a' }}>
            RFQ-<EFinline value={draft.docNo} onChange={v => setDraft(d => ({ ...d, docNo: v }))} />
          </div>
          <div style={{ marginTop:2 }}>Date / 日期 <EFinline value={draft.dateIssued} onChange={v => setDraft(d => ({ ...d, dateIssued: v }))} /></div>
          <div>Reply by / 回复期限 <EFinline value={draft.replyBy} onChange={v => setDraft(d => ({ ...d, replyBy: v }))} /></div>
        </div>
      </div>

      <div style={{ ...ds.title, fontSize:26, letterSpacing:'0.2em' }}>QUOTATION REQUEST</div>
      <div style={ds.titleEn}>询 价 单 · 見積依頼書</div>

      <div style={ds.hRow}>
        <div>
          <div style={ds.recipName}>To · 致：<EFinline value={draft.recipName} onChange={v => setDraft(d => ({ ...d, recipName: v }))} /></div>
          <div style={ds.recipMeta}>
            <EFblock value={draft.recipAddress} onChange={v => setDraft(d => ({ ...d, recipAddress: v }))} multiline />
            ATTN · 联系人：<EFinline value={draft.recipContact} onChange={v => setDraft(d => ({ ...d, recipContact: v }))} /><br/>
            TEL <EFinline value={draft.recipPhone} onChange={v => setDraft(d => ({ ...d, recipPhone: v }))} />  ·  <EFinline value={draft.recipEmail} onChange={v => setDraft(d => ({ ...d, recipEmail: v }))} />
          </div>
        </div>
        <div style={{ ...ds.meta, marginTop:24 }}>
          <span style={ds.metaLabel}>Incoterm</span><EFinline value={draft.incoterm} onChange={v => setDraft(d => ({ ...d, incoterm: v }))} /><br/>
          <span style={ds.metaLabel}>Currency / 货币</span><EFinline value={draft.currency} onChange={v => setDraft(d => ({ ...d, currency: v }))} /><br/>
          <span style={ds.metaLabel}>Delivery / 交期</span><EFinline value={draft.deliveryNeed} onChange={v => setDraft(d => ({ ...d, deliveryNeed: v }))} /><br/>
          <span style={ds.metaLabel}>Buyer / 担当</span><EFinline value={draft.buyer} onChange={v => setDraft(d => ({ ...d, buyer: v }))} />
        </div>
      </div>

      <div style={{ ...ds.notes, marginTop:24, paddingTop:16, fontSize:11, color:'#0a0a0a' }}>
        Dear <EFinline value={draft.recipContact} onChange={v => setDraft(d => ({ ...d, recipContact: v }))} />,<br/>
        <EFblock
          value={draft.intro}
          onChange={v => setDraft(d => ({ ...d, intro: v }))}
          multiline
          style={{ marginTop:6 }}
        />
      </div>

      <table style={ds.table}>
        <thead>
          <tr>
            <th style={{ ...ds.th, width:24 }}>No.</th>
            <th style={ds.th}>Description / 品名</th>
            <th style={{ ...ds.th, width:90, textAlign:'right' }}>Qty / 数量</th>
            <th style={{ ...ds.th, width:110, textAlign:'right' }}>Target / 参考价</th>
            <th style={{ ...ds.th, width:100, textAlign:'right' }}>Notes / 备注</th>
            <th className="no-print" style={{ ...ds.th, width:24 }}></th>
          </tr>
        </thead>
        <tbody>
          {draft.lines.map((it, idx) => (
            <tr key={idx}>
              <td style={{ ...ds.td, ...ds.tdNum }}>{idx + 1}</td>
              <td style={ds.td}>
                <div style={{ fontWeight:500 }}><EFinline value={it.name} onChange={v => setLine(idx, 'name', v)} /></div>
                <div style={{ fontSize:10, color:'#555', marginTop:2 }}><EFinline value={it.spec} onChange={v => setLine(idx, 'spec', v)} multiline /></div>
              </td>
              <td style={{ ...ds.td, ...ds.tdNum }}>
                <EFinline value={(it.qty || 0).toLocaleString()} onChange={v => setLineNum(idx, 'qty', v)} /> {it.unit}
              </td>
              <td style={{ ...ds.td, ...ds.tdNum }}>
                <EFinline value={it.target_price || ''} onChange={v => setLine(idx, 'target_price', v)} />
              </td>
              <td style={{ ...ds.td, fontSize:10, color:'#555' }}>
                <EFinline value={it.note || ''} onChange={v => setLine(idx, 'note', v)} multiline />
              </td>
              <td className="no-print" style={{ ...ds.td, textAlign:'center', verticalAlign:'middle' }}>
                <span onClick={() => removeLine(idx)} style={{ cursor:'pointer', color:'#bbb', fontSize:11 }} title="行を削除">✕</span>
              </td>
            </tr>
          ))}
          {[...Array(padCount)].map((_, i) => (
            <tr key={'pad'+i}>
              <td style={ds.td}>&nbsp;</td>
              <td style={ds.td}>&nbsp;</td>
              <td style={ds.td}>&nbsp;</td>
              <td style={ds.td}>&nbsp;</td>
              <td style={ds.td}>&nbsp;</td>
              <td className="no-print" style={ds.td}></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="no-print" style={{ marginTop:8, textAlign:'right' }}>
        <span onClick={addLine} style={{ fontSize:10, color:'#888', cursor:'pointer', borderBottom:'1px dashed #888' }}>+ 行を追加</span>
      </div>

      <div style={ds.notes}>
        <div style={ds.notesH}>Required Quote Items · 见积内容</div>
        <EFblock value={draft.notes} onChange={v => setDraft(d => ({ ...d, notes: v }))} multiline />
      </div>

      <div style={ds.stamp}>
        <div style={ds.stampBox}>
          <div>ELECTRONICALLY ISSUED</div>
          <div style={{ marginTop:3 }}><EFinline value={draft.dateIssued} onChange={v => setDraft(d => ({ ...d, dateIssued: v }))} /> · BAOFlow</div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Drafts — built from selection
// ───────────────────────────────────────────────────────────
function buildJPDraft(kind, deals, client) {
  const today = '2026.04.25';
  const isInvoice = kind === 'invoice';
  const isQuote = kind === 'quote';
  const isDelivery = kind === 'delivery';
  const dateMain = isInvoice ? '2026.05.31' : isQuote ? '2026.05.25' : (deals[0] && fmtDateLong(deals[0].delivery)) || today;

  const intro = isInvoice
    ? '下記の通り御請求申し上げます。\nご確認のほどよろしくお願いいたします。'
    : isQuote
    ? '下記の通り御見積申し上げます。\nご検討のほどよろしくお願いいたします。'
    : '下記の通り納品申し上げます。';

  const notes = isInvoice
    ? `${SENDER.bank_jp}\n\n・お支払期限：${dateMain}\n・恐れ入りますが、振込手数料は貴社にてご負担ください。\n・本書は適格請求書（インボイス）として発行しています。`
    : isQuote
    ? `・お支払条件：${client.payment_terms}\n・有効期限：${dateMain}\n・仕様確定後、版下データのご提供から納品まで約25-30日となります。`
    : '・数量・内容に相違がございましたら、納品日より7日以内に弊社担当までご連絡ください。\n・本書は納品確認のためのものです。お支払いは別途請求書をご確認ください。';

  return {
    senderName: SENDER.name_jp,
    senderAddr: SENDER.address_jp,
    senderPhone: SENDER.phone,
    senderEmail: SENDER.email,
    senderRegistration: SENDER.registration,
    docNo: deals.map(d => d.id.replace('BAO-', '')).join('+'),
    dateIssued: today,
    dateMain,
    recipName: client.name,
    recipBilling: client.billing_to || '',
    recipAddress: client.address,
    intro,
    taxRate: client.tax_rate ?? 10,
    lines: deals.map(dealToLine),
    notes,
  };
}

function buildRFQDraft(deals, factory) {
  const today = '2026.04.25';
  const replyBy = '2026.05.05';

  const intro = `Please kindly send us your best quotation for the items below. We are evaluating multiple suppliers — your prompt and competitive offer is appreciated.\n敬请就以下品项给予最优报价。我方正在比较多家供应商，请尽快回复。`;

  const notes = '・Quote should include unit price, MOQ, lead time, packing details.\n  请报单价、起订量、交期、外箱包装。\n・Sample fee and tooling cost should be itemized separately.\n  打样费及版费请另列。\n・Validity of the quote should be at least 30 days.\n  报价有效期至少30天。';

  return {
    senderName: SENDER.name_en,
    senderAddr: SENDER.address_en,
    senderPhone: SENDER.phone,
    senderEmail: SENDER.email,
    docNo: deals.map(d => d.id.replace('BAO-', '')).join('+'),
    dateIssued: today,
    replyBy,
    recipName: factory ? factory.name_cn : '',
    recipAddress: factory ? factory.address : '',
    recipContact: factory ? factory.contact : '',
    recipPhone: factory ? factory.phone : '',
    recipEmail: factory ? factory.email : '',
    incoterm: factory ? factory.incoterm : 'FOB',
    currency: factory ? factory.currency : 'USD',
    deliveryNeed: deals[0] ? fmtDateLong(deals[0].delivery) : '',
    buyer: deals[0] ? deals[0].sales : '',
    intro,
    lines: deals.map((d, i) => ({
      no: i + 1,
      name: d.name,
      spec: d.spec,
      qty: d.qty,
      unit: 'pcs',
      target_price: '$' + d.unit_usd.toFixed(3) + ' /pc',
      note: `Ver ${d.version}`,
    })),
    notes,
  };
}

// ───────────────────────────────────────────────────────────
// Print Center — multi-select + editable preview
// ───────────────────────────────────────────────────────────
function PrintCenter() {
  const [step, setStep] = React.useState('pick');
  const [selectedIds, setSelectedIds] = React.useState(new Set());
  const [docType, setDocType] = React.useState('invoice'); // invoice | quote | delivery | rfq
  const [draft, setDraft] = React.useState(null);

  // Group deals by client
  const groups = React.useMemo(() => {
    return CLIENTS.map(c => ({
      client: c,
      deals: DEALS.filter(d => d.client === c.id),
      total: DEALS.filter(d => d.client === c.id).reduce((s,d) => s + d.total_jpy, 0),
    })).filter(g => g.deals.length > 0);
  }, []);
  const allOpen = React.useMemo(() => Object.fromEntries(groups.map(g => [g.client.id, true])), [groups]);
  const [openMap, setOpenMap] = React.useState(allOpen);

  const selectedDeals = React.useMemo(() => DEALS.filter(d => selectedIds.has(d.id)), [selectedIds]);
  const selectedClients = React.useMemo(() => {
    const set = new Set(selectedDeals.map(d => d.client));
    return Array.from(set).map(id => clientById(id));
  }, [selectedDeals]);
  const multiClient = selectedClients.length > 1;
  const totalSelectedJpy = selectedDeals.reduce((s,d) => s + d.total_jpy, 0);

  const toggleDeal = (id) => {
    setSelectedIds(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleClient = (cid) => {
    const dealsInClient = DEALS.filter(d => d.client === cid).map(d => d.id);
    setSelectedIds(s => {
      const next = new Set(s);
      const allSel = dealsInClient.every(id => next.has(id));
      if (allSel) dealsInClient.forEach(id => next.delete(id));
      else dealsInClient.forEach(id => next.add(id));
      return next;
    });
  };
  const clearAll = () => setSelectedIds(new Set());

  // Proceed to preview — build draft
  const proceed = (kindOverride) => {
    if (selectedDeals.length === 0) return;
    const kind = kindOverride || docType;
    if (kind === 'rfq') {
      // RFQ targets factory, not client. If multi-client, use first deal's factory
      const firstFactory = factoryByName(selectedDeals[0].factory) || FACTORIES_DATA[0];
      setDraft({ kind:'rfq', data: buildRFQDraft(selectedDeals, firstFactory) });
    } else {
      // group: if multi-client, we'll need 1 page per client
      setDraft({ kind, perClient: groupSelectedByClient(selectedDeals, kind) });
    }
    setDocType(kind);
    setStep('preview');
  };

  // when docType changes IN preview, rebuild
  React.useEffect(() => {
    if (step !== 'preview') return;
    if (selectedDeals.length === 0) return;
    if (docType === 'rfq') {
      const firstFactory = factoryByName(selectedDeals[0].factory) || FACTORIES_DATA[0];
      setDraft({ kind:'rfq', data: buildRFQDraft(selectedDeals, firstFactory) });
    } else {
      setDraft({ kind:docType, perClient: groupSelectedByClient(selectedDeals, docType) });
    }
    // eslint-disable-next-line
  }, [docType]);

  function groupSelectedByClient(deals, kind) {
    const map = new Map();
    deals.forEach(d => {
      if (!map.has(d.client)) map.set(d.client, []);
      map.get(d.client).push(d);
    });
    return Array.from(map.entries()).map(([cid, list]) => ({
      client: clientById(cid),
      data: buildJPDraft(kind, list, clientById(cid)),
    }));
  }

  // Update one client's draft slice
  const setClientDraft = (cid, fnOrVal) => {
    setDraft(d => {
      if (!d || !d.perClient) return d;
      const next = d.perClient.map(slice =>
        slice.client.id === cid
          ? { ...slice, data: typeof fnOrVal === 'function' ? fnOrVal(slice.data) : fnOrVal }
          : slice
      );
      return { ...d, perClient: next };
    });
  };
  const setRFQDraft = (fnOrVal) => {
    setDraft(d => ({ ...d, data: typeof fnOrVal === 'function' ? fnOrVal(d.data) : fnOrVal }));
  };

  const docTypes = [
    { key:'invoice', label:'請求書' },
    { key:'quote', label:'見積書' },
    { key:'delivery', label:'納品書' },
    { key:'rfq', label:'見積依頼書 (工場)' },
  ];

  return (
    <div style={printStyles.shell}>
      <style>{editableHover}</style>

      {/* Toolbar */}
      <div style={printStyles.toolbar}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={printStyles.step(step === 'pick', step === 'preview')}>
            <div style={printStyles.stepNum(step === 'pick', step === 'preview')}>1</div>
            <span>案件選択</span>
            {selectedIds.size > 0 && step === 'pick' && <span style={printStyles.selBadge}>{selectedIds.size}</span>}
          </div>
          <div style={printStyles.stepDiv} />
          <div style={printStyles.step(step === 'preview', false)}>
            <div style={printStyles.stepNum(step === 'preview', false)}>2</div>
            <span>プレビュー / 編集</span>
          </div>
          <div style={printStyles.stepDiv} />
          <div style={printStyles.step(false, false)}>
            <div style={printStyles.stepNum(false, false)}>3</div>
            <span>印刷 / PDF</span>
          </div>
        </div>

        <div style={{ flex:1 }} />

        {step === 'pick' && (
          <>
            <div style={{ fontSize:11, color:'#888' }}>
              {selectedIds.size === 0
                ? '帳票を発行する案件を選択してください'
                : `${selectedIds.size}件選択 · ${selectedClients.length}社 · ${jpyAmount(totalSelectedJpy)}`}
            </div>
            {selectedIds.size > 0 && (
              <button style={printStyles.ghostBtn} onClick={clearAll}>選択解除</button>
            )}
            <button
              style={selectedIds.size === 0 ? printStyles.printBtnDis : printStyles.printBtn}
              disabled={selectedIds.size === 0}
              onClick={() => proceed()}
            >
              次へ
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {step === 'preview' && (
          <>
            <div style={printStyles.segLine}>
              {docTypes.map(dt => (
                <div key={dt.key} style={printStyles.segItem(docType === dt.key)} onClick={() => setDocType(dt.key)}>
                  {dt.label}
                </div>
              ))}
            </div>
            {docType !== 'rfq' && multiClient && (
              <div style={printStyles.bulkNotice}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#cf5a3a' }}></span>
                複数社 — 取引先ごとに{docTypes.find(t => t.key === docType)?.label}を発行
              </div>
            )}
            <button style={printStyles.printBtn} onClick={() => window.print()}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
              </svg>
              印刷 / PDF
            </button>
            <div
              onClick={() => setStep('pick')}
              style={{ fontSize:10, color:'#888', cursor:'pointer', borderBottom:'1px solid #888' }}
            >案件を変更</div>
          </>
        )}
      </div>

      {/* Step 1 — Picker */}
      {step === 'pick' && (
        <div style={printStyles.pickWrap}>
          <div style={printStyles.pickIntro}>
            <div>
              <div style={printStyles.pickIntroTitle}>取引先別 案件一覧</div>
              <div style={printStyles.pickIntroSub}>
                チェックを入れた案件で帳票を発行。<b>同じ取引先の複数案件を選ぶと一括請求書</b>として1枚にまとまります。
              </div>
            </div>
            <div style={printStyles.pickActions}>
              <button style={printStyles.ghostBtn} onClick={() => setSelectedIds(new Set(DEALS.filter(d => d.status === 'delivered').map(d => d.id)))}>
                納品済をすべて選択
              </button>
              <button style={printStyles.ghostBtn} onClick={() => setSelectedIds(new Set(DEALS.map(d => d.id)))}>
                全件選択
              </button>
            </div>
          </div>

          {groups.map(g => {
            const groupSel = g.deals.filter(d => selectedIds.has(d.id));
            const allSel = groupSel.length === g.deals.length;
            const someSel = groupSel.length > 0 && !allSel;
            const open = openMap[g.client.id] !== false;
            return (
              <div key={g.client.id} style={printStyles.groupCard}>
                <div style={printStyles.groupHead} onClick={() => setOpenMap(m => ({ ...m, [g.client.id]: !open }))}>
                  <div onClick={(e) => { e.stopPropagation(); toggleClient(g.client.id); }} style={printStyles.cb(allSel, someSel)}>
                    {allSel && <span style={{ color:'#fff', fontSize:10, lineHeight:1 }}>✓</span>}
                    {someSel && <span style={{ width:7, height:1.5, background:'#fff' }}></span>}
                  </div>
                  <div>
                    <div style={printStyles.groupName}>{g.client.name}</div>
                    <div style={printStyles.groupMeta}>{g.client.id} · {g.client.industry}</div>
                  </div>
                  <div style={{ fontSize:10, color:'#888' }}>
                    {open ? '▾' : '▸'}  {g.deals.length}件
                    {groupSel.length > 0 && <span style={{ color:'#0a0a0a', marginLeft:6 }}>· {groupSel.length}件選択中</span>}
                  </div>
                  <div style={printStyles.rollupNum}>{jpyAmount(g.total)}</div>
                  <div style={printStyles.rollupSub}>累計</div>
                  <div style={{ fontSize:10, color:'#888', textAlign:'right' }}>{g.client.payment_terms}</div>
                </div>
                {open && g.deals.map(d => {
                  const sel = selectedIds.has(d.id);
                  return (
                    <div key={d.id} style={printStyles.dealRow(sel)} onClick={() => toggleDeal(d.id)}>
                      <div style={printStyles.cb(sel, false)}>
                        {sel && <span style={{ color:'#fff', fontSize:10, lineHeight:1 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize:10, color:'#888', fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>{d.id}</div>
                        <div style={{ fontSize:11, fontWeight:500, marginTop:1 }}>{d.name}</div>
                      </div>
                      <div style={{ fontSize:10, color:'#666' }}>
                        {d.spec}
                      </div>
                      <div style={{ fontSize:10, display:'flex', alignItems:'center', gap:5 }}>
                        <StatusDot status={d.status} size={5} />
                        {STATUS[d.status].label}
                      </div>
                      <div style={printStyles.rollupNum}>{jpyAmount(d.total_jpy)}</div>
                      <div style={{ fontSize:10, color:'#888', textAlign:'right' }}>納期 {fmtDate(d.delivery)}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 2 — Preview */}
      {step === 'preview' && draft && (
        <div style={printStyles.previewWrap}>
          {draft.kind === 'rfq' && (
            <QuotationRequestDoc draft={draft.data} setDraft={setRFQDraft} />
          )}
          {draft.kind !== 'rfq' && draft.perClient && draft.perClient.map((slice, idx) => (
            <JPDoc
              key={slice.client.id}
              kind={draft.kind}
              draft={slice.data}
              setDraft={(fnOrVal) => setClientDraft(slice.client.id, fnOrVal)}
              pageNo={idx + 1}
              pageOf={draft.perClient.length}
            />
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  PrintCenter,
  JPDoc, QuotationRequestDoc, Editable,
});
