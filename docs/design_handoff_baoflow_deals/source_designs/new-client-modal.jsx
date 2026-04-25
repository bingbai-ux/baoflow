// New Client Modal — opens from the "+ 新規クライアント" link in the popover
// Captures company info, contact, default FX & markup

const ncStyles = {
  overlay: { position:'fixed', inset:0, background:'rgba(10,10,10,0.4)', backdropFilter:'blur(2px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:40, fontFamily:"'Zen Kaku Gothic New', sans-serif" },
  modal: { background:'#fff', borderRadius:16, width:'100%', maxWidth:560, maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,0.25)' },
  header: { padding:'20px 24px 14px', borderBottom:'1px solid #f0f0ee', display:'flex', alignItems:'center', justifyContent:'space-between' },
  title: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:18, color:'#0a0a0a' },
  body: { padding:'20px 24px', overflowY:'auto', display:'flex', flexDirection:'column', gap:18, flex:1 },
  footer: { padding:'12px 20px', borderTop:'1px solid #f0f0ee', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fafaf9' },
  label: { fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, fontWeight:500 },
  input: { width:'100%', border:'1px solid #e8e8e6', borderRadius:6, padding:'8px 11px', fontSize:13, fontFamily:'inherit', outline:'none', background:'#fff', color:'#0a0a0a' },
  inputNum: { fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', textAlign:'right' },
  field: { display:'flex', flexDirection:'column' },
  row: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  closeBtn: { width:28, height:28, borderRadius:6, background:'transparent', border:'none', cursor:'pointer', color:'#888', fontSize:18, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' },
  step: { display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#888' },
  stepActive: { color:'#0a0a0a', fontWeight:500 },
  stepDot: { width:18, height:18, borderRadius:'50%', background:'#e8e8e6', color:'#888', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:10, fontFamily:"'Fraunces', serif" },
  stepDotActive: { background:'#0a0a0a', color:'#fff' },
  hint: { fontSize:10, color:'#bbb', marginTop:4, lineHeight:1.5 },
  sectionTitle: { fontFamily:"'Fraunces', serif", fontWeight:600, fontSize:13, color:'#0a0a0a', marginTop:6, marginBottom:-4, paddingTop:8, borderTop:'1px solid #f0f0ee' },
};

function NewClientModal({ onClose, onCreate }) {
  const [name, setName] = React.useState('');
  const [shortName, setShortName] = React.useState('');
  const [contact, setContact] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [paymentTerms, setPaymentTerms] = React.useState('30');
  const [defaultFx, setDefaultFx] = React.useState('155');
  const [defaultMarkup, setDefaultMarkup] = React.useState('45');
  const [tag, setTag] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const canCreate = name.trim().length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    if (onCreate) onCreate({ name, shortName, contact, email, phone, paymentTerms, defaultFx, defaultMarkup, tag, notes });
    onClose();
  };

  return (
    <div style={ncStyles.overlay} onClick={onClose}>
      <div style={ncStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={ncStyles.header}>
          <div>
            <div style={ncStyles.title}>新規クライアント</div>
            <div style={{ fontSize:11, color:'#888', marginTop:3 }}>会社情報と取引デフォルトを登録</div>
          </div>
          <button style={ncStyles.closeBtn} onClick={onClose} onMouseEnter={e => e.currentTarget.style.background='#f5f5f4'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>×</button>
        </div>

        <div style={ncStyles.body}>
          <div style={ncStyles.field}>
            <div style={ncStyles.label}>会社名 <span style={{ color:'#dc2626' }}>*</span></div>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="例: 株式会社カネコ" style={ncStyles.input} />
          </div>

          <div style={ncStyles.row}>
            <div style={ncStyles.field}>
              <div style={ncStyles.label}>略称 (テーブル表示用)</div>
              <input value={shortName} onChange={e => setShortName(e.target.value)} placeholder="例: カネコ" style={ncStyles.input} />
            </div>
            <div style={ncStyles.field}>
              <div style={ncStyles.label}>タグ</div>
              <select value={tag} onChange={e => setTag(e.target.value)} style={ncStyles.input}>
                <option value="">選択しない</option>
                <option value="既存">既存</option>
                <option value="新規">新規</option>
                <option value="重要顧客">重要顧客</option>
                <option value="休眠">休眠</option>
              </select>
            </div>
          </div>

          <div style={ncStyles.sectionTitle}>連絡先</div>

          <div style={ncStyles.row}>
            <div style={ncStyles.field}>
              <div style={ncStyles.label}>担当者名</div>
              <input value={contact} onChange={e => setContact(e.target.value)} placeholder="例: 山田 太郎" style={ncStyles.input} />
            </div>
            <div style={ncStyles.field}>
              <div style={ncStyles.label}>電話番号</div>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="03-0000-0000" style={ncStyles.input} />
            </div>
          </div>

          <div style={ncStyles.field}>
            <div style={ncStyles.label}>メール</div>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@example.co.jp" style={ncStyles.input} />
          </div>

          <div style={ncStyles.sectionTitle}>取引デフォルト</div>
          <div style={{ fontSize:10, color:'#bbb', marginTop:-12, lineHeight:1.6 }}>
            このクライアントの新規見積に自動適用されます。案件ごとに上書き可能。
          </div>

          <div style={ncStyles.row}>
            <div style={ncStyles.field}>
              <div style={ncStyles.label}>FX (JPY/USD)</div>
              <input value={defaultFx} onChange={e => setDefaultFx(e.target.value)} style={{ ...ncStyles.input, ...ncStyles.inputNum }} />
            </div>
            <div style={ncStyles.field}>
              <div style={ncStyles.label}>掛け率 (%)</div>
              <input value={defaultMarkup} onChange={e => setDefaultMarkup(e.target.value)} style={{ ...ncStyles.input, ...ncStyles.inputNum }} />
              <div style={ncStyles.hint}>原価に対する利益率の目安</div>
            </div>
          </div>

          <div style={ncStyles.field}>
            <div style={ncStyles.label}>支払い条件</div>
            <select value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} style={ncStyles.input}>
              <option value="prepay">前払い (100%)</option>
              <option value="50_50">前払い 50% / 納品時 50%</option>
              <option value="30">月末締め翌月末払い (Net 30)</option>
              <option value="60">月末締め翌々月末払い (Net 60)</option>
              <option value="custom">その他（メモに記載）</option>
            </select>
          </div>

          <div style={ncStyles.field}>
            <div style={ncStyles.label}>メモ</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="特記事項、好み、過去の取引メモなど" style={{ ...ncStyles.input, minHeight:60, resize:'vertical', fontFamily:'inherit' }} />
          </div>
        </div>

        <div style={ncStyles.footer}>
          <div style={{ fontSize:10, color:'#bbb' }}>
            <span style={{ color:'#dc2626' }}>*</span> は必須項目
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={onClose} style={{ background:'transparent', color:'#555', border:'1px solid #e8e8e6', borderRadius:6, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>キャンセル</button>
            <button onClick={handleCreate} disabled={!canCreate} style={{ background: canCreate ? '#0a0a0a' : '#e8e8e6', color:'#fff', border:'none', borderRadius:6, padding:'7px 18px', fontSize:12, cursor: canCreate ? 'pointer' : 'not-allowed', fontFamily:'inherit', fontWeight:500 }}>登録 → 案件作成へ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.NewClientModal = NewClientModal;
