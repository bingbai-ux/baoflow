// Shared mock data and helpers for all deals-redesign variations
// Style objects use unique names. All components are exposed on window for cross-file use.

const STATUS = {
  quoting:         { label: '見積中',           short: '見積',   step: 1, dot: '#bbbbbb' },
  quote_confirmed: { label: '見積確定',         short: '確定',   step: 2, dot: '#22c55e' },
  paid:            { label: '入金完了',         short: '入金',   step: 3, dot: '#e5a32e' },
  data_confirmed: { label: 'データ確認完了',     short: 'データ', step: 4, dot: '#0a0a0a' },
  in_production:   { label: '製作中',           short: '製作',   step: 5, dot: '#0a0a0a' },
  shipped:         { label: '工場発送完了',     short: '発送',   step: 6, dot: '#888888' },
  delivered:       { label: '納品完了',         short: '納品',   step: 7, dot: '#22c55e' },
};
const STATUS_ORDER = ['quoting','quote_confirmed','paid','data_confirmed','in_production','shipped','delivered'];

// Realistic mock — Japanese client packaging deals, China factories
const CLIENTS = [
  { id: 'c01', name: '青葉珈琲焙煎所',     short: '青葉珈琲',    contact:'丸山 健介', phone:'03-5421-8870', email:'maruyama@aoba-coffee.jp',     address:'〒150-0001 東京都渋谷区神宮前4-12-7 青葉ビル3F', billing_to:'同上 経理部 宛',                tax_id:'T2010401012345', payment_terms:'月末締め翌月末払い', tax_rate:10, since:'2023-08-12', industry:'焙煎・小売' },
  { id: 'c02', name: 'KURASHI 食品株式会社', short: 'KURASHI',     contact:'石田 真理子', phone:'06-6443-2210', email:'r.ishida@kurashi-foods.co.jp', address:'〒530-0001 大阪府大阪市北区梅田2-5-25 ハービスPLAZA 8F', billing_to:'本社 経理課',                  tax_id:'T6120001098765', payment_terms:'15日締め翌月15日払い', tax_rate:8,  since:'2022-04-01', industry:'食品メーカー' },
  { id: 'c03', name: 'mui tea',             short: 'mui tea',     contact:'近藤 七海',   phone:'075-708-2244', email:'nanami@muitea.com',           address:'〒604-8093 京都府京都市中京区柳馬場通三条下る槌屋町87', billing_to:'同上',                          tax_id:'T7130001023456', payment_terms:'納品月末払い',         tax_rate:10, since:'2024-01-20', industry:'お茶ブランド' },
  { id: 'c04', name: 'TOKIWA Bakery',       short: 'TOKIWA',      contact:'常盤 哲也',   phone:'052-961-3380', email:'tetsuya@tokiwa-bakery.jp',    address:'〒460-0008 愛知県名古屋市中区栄3-15-21',          billing_to:'本部 経理係',                   tax_id:'T3180001076543', payment_terms:'月末締め翌々月10日払い', tax_rate:8,  since:'2021-09-15', industry:'パン製造・小売' },
  { id: 'c05', name: '小田原製菓',           short: '小田原製菓',   contact:'柏木 真一',   phone:'0465-22-1180', email:'kashiwagi@odawara-seika.jp',  address:'〒250-0011 神奈川県小田原市栄町2-9-39',           billing_to:'同上',                          tax_id:'T9020001054321', payment_terms:'月末締め翌月末払い',     tax_rate:8,  since:'2023-02-08', industry:'和菓子製造' },
  { id: 'c06', name: 'sanorè',              short: 'sanorè',      contact:'佐野 玲',     phone:'03-6427-9912', email:'rei@sanore.jp',               address:'〒107-0062 東京都港区南青山5-4-15 青山ビル6F',     billing_to:'経理 sanorè 株式会社',         tax_id:'T8010401087654', payment_terms:'月末締め翌月末払い',     tax_rate:10, since:'2025-11-03', industry:'コスメブランド' },
];
const FACTORIES_DATA = [
  { id:'f01', name:'深圳ABC包装',   name_cn:'深圳ABC包装有限公司',  city:'深圳',   country:'中国 広東省', contact:'Zhang Wei',  phone:'+86 755 8392 1100', email:'zhang@szabc-pkg.cn',   wechat:'szabc_zw',     address:'广东省深圳市宝安区福永街道桥头第一工业区A栋',    specialties:['紙袋','紙器','箔押し'],         payment:'30% T/T 前金 + 70% 出荷前',   incoterm:'FOB 深圳',  currency:'USD', lead_time:'25-30日', stars:{quality:5, delivery:4, price:4}, since:'2022-06-10' },
  { id:'f02', name:'東莞XY印刷',     name_cn:'东莞XY印刷股份有限公司', city:'東莞',   country:'中国 広東省', contact:'Liu Fang',   phone:'+86 769 2266 3344', email:'liu.fang@xy-print.cn', wechat:'liufang_xy',   address:'广东省东莞市长安镇上沙工业区第二街8号',           specialties:['シール','ラベル','フルカラー印刷'], payment:'50% T/T + 50% コピーB/L',     incoterm:'FOB 深圳',  currency:'USD', lead_time:'15-20日', stars:{quality:4, delivery:5, price:4}, since:'2021-03-22' },
  { id:'f03', name:'寧波PackCo',     name_cn:'宁波派克包装制品有限公司', city:'寧波',   country:'中国 浙江省', contact:'Chen Hao',   phone:'+86 574 8755 6622', email:'chen@nbpackco.com',    wechat:'chen_nbpack',  address:'浙江省宁波市鄞州区潘火街道金达路200号',          specialties:['フィルム','OPP','蒸着'],         payment:'30% T/T + 70% 出荷前',         incoterm:'FOB 寧波',  currency:'USD', lead_time:'20-25日', stars:{quality:4, delivery:4, price:5}, since:'2022-11-05' },
  { id:'f04', name:'蘇州ZHL',        name_cn:'苏州中海立包装科技有限公司', city:'蘇州',   country:'中国 江蘇省', contact:'Wang Lei',   phone:'+86 512 6677 8899', email:'wang.lei@zhl-pkg.com', wechat:'wanglei_zhl',  address:'江苏省苏州市相城区元和街道元盛路18号',           specialties:['食品包材','バリア','グラビア'], payment:'30% T/T + 70% 出荷前',         incoterm:'FOB 上海',  currency:'USD', lead_time:'25-35日', stars:{quality:5, delivery:4, price:3}, since:'2023-05-18' },
  { id:'f05', name:'広州PrimePack', name_cn:'广州普睿包装有限公司',     city:'広州',   country:'中国 広東省', contact:'Huang Mei',  phone:'+86 20 8866 4455',  email:'mei@primepack.cn',     wechat:'huangmei_pp',  address:'广东省广州市番禺区南村镇兴业大道东788号',        specialties:['紙箱','詰合せBOX','クラフト紙'], payment:'40% T/T + 60% 出荷前',         incoterm:'EXW 広州',  currency:'USD', lead_time:'18-25日', stars:{quality:4, delivery:4, price:4}, since:'2022-01-30' },
  { id:'f06', name:'杭州GreenBox',  name_cn:'杭州绿盒包装设计有限公司', city:'杭州',   country:'中国 浙江省', contact:'Sun Jie',    phone:'+86 571 8822 9911', email:'sun.jie@greenbox.cn',  wechat:'sunjie_gb',    address:'浙江省杭州市余杭区仓前街道高教路1288号',         specialties:['高級箱','箔押し','特殊紙'],     payment:'30% T/T + 70% L/C at sight',  incoterm:'FOB 上海',  currency:'USD', lead_time:'30-40日', stars:{quality:5, delivery:3, price:3}, since:'2024-02-14' },
];
const FACTORIES = FACTORIES_DATA.map(f => f.name);
const SALES = ['田中', '佐藤', '林', '中村'];

const DEALS = [
  // 青葉珈琲
  { id:'BAO-0231', name:'ドリップバッグ袋 春版', client:'c01', spec:'クラフト紙140g / 4色印刷', qty:5000, unit_usd:0.42, total_jpy:344400, profit_pct:38.2, status:'in_production', delivery:'2026-05-12', factory:'深圳ABC包装', sales:'田中', version:'v3', updated:'2026-04-22', memo:'箔押し1色追加要望、版代別途' },
  { id:'BAO-0228', name:'ギフトBOX (250g用)',    client:'c01', spec:'白板240g / フルカラー / 窓抜', qty:1200, unit_usd:1.85, total_jpy:362400, profit_pct:42.0, status:'quote_confirmed', delivery:'2026-06-30', factory:'東莞XY印刷', sales:'田中', version:'v2', updated:'2026-04-21', memo:'母の日キャンペーン用' },
  { id:'BAO-0225', name:'コーヒー豆袋 200g',     client:'c01', spec:'アルミ蒸着 / 2色印刷 / バルブ付', qty:8000, unit_usd:0.28, total_jpy:368000, profit_pct:35.5, status:'delivered', delivery:'2026-04-05', factory:'寧波PackCo', sales:'田中', version:'v1', updated:'2026-04-08', memo:'継続発注予定あり' },

  // KURASHI
  { id:'BAO-0230', name:'味噌パウチ 500g',       client:'c02', spec:'バリアフィルム / グラビア4色', qty:12000, unit_usd:0.15, total_jpy:294000, profit_pct:28.0, status:'paid', delivery:'2026-05-25', factory:'蘇州ZHL', sales:'佐藤', version:'v2', updated:'2026-04-19', memo:'食品検査必須' },
  { id:'BAO-0227', name:'ふりかけ小袋 (15袋セット)', client:'c02', spec:'PETフィルム / 4色 / ジッパー', qty:25000, unit_usd:0.08, total_jpy:326000, profit_pct:22.5, status:'in_production', delivery:'2026-05-08', factory:'蘇州ZHL', sales:'佐藤', version:'v3', updated:'2026-04-15', memo:'' },
  { id:'BAO-0223', name:'お茶漬け詰合せBOX',     client:'c02', spec:'クラフト紙350g / 1色 / 中仕切', qty:3000, unit_usd:0.95, total_jpy:465000, profit_pct:45.0, status:'shipped', delivery:'2026-04-28', factory:'広州PrimePack', sales:'佐藤', version:'v1', updated:'2026-04-23', memo:'船便EXW' },
  { id:'BAO-0220', name:'醤油ボトルラベル',     client:'c02', spec:'透明PET / フルカラー / 耐水', qty:50000, unit_usd:0.04, total_jpy:326000, profit_pct:30.0, status:'delivered', delivery:'2026-03-20', factory:'東莞XY印刷', sales:'佐藤', version:'v2', updated:'2026-03-22', memo:'' },

  // mui tea
  { id:'BAO-0232', name:'ティーバッグ個包装 アール',  client:'c03', spec:'不織布 / 1色 / タグ紐付', qty:30000, unit_usd:0.06, total_jpy:293400, profit_pct:32.0, status:'quoting', delivery:'2026-06-15', factory:'—', sales:'林', version:'v1', updated:'2026-04-23', memo:'工場2社相見積中' },
  { id:'BAO-0226', name:'紅茶缶 70g',            client:'c03', spec:'ブリキ缶 / オフセット印刷', qty:2000, unit_usd:1.40, total_jpy:457800, profit_pct:48.0, status:'quote_confirmed', delivery:'2026-07-10', factory:'杭州GreenBox', sales:'林', version:'v2', updated:'2026-04-18', memo:'リピート2回目' },
  { id:'BAO-0218', name:'紙箱 (12本入)',        client:'c03', spec:'白板 / フルカラー / 内側ニス', qty:1500, unit_usd:0.85, total_jpy:208200, profit_pct:40.0, status:'data_confirmed', delivery:'2026-05-30', factory:'杭州GreenBox', sales:'林', version:'v3', updated:'2026-04-17', memo:'最終データ確認済 製作開始待ち' },

  // TOKIWA
  { id:'BAO-0229', name:'食パン袋 (400g用)',    client:'c04', spec:'OPP透明 / 1色 / 通気孔', qty:80000, unit_usd:0.012, total_jpy:156800, profit_pct:18.0, status:'in_production', delivery:'2026-05-05', factory:'寧波PackCo', sales:'中村', version:'v1', updated:'2026-04-20', memo:'高速発注品' },
  { id:'BAO-0224', name:'ロゴシール 直径40mm',  client:'c04', spec:'コート紙 / フルカラー / 強粘', qty:100000, unit_usd:0.008, total_jpy:130400, profit_pct:35.0, status:'shipped', delivery:'2026-04-25', factory:'東莞XY印刷', sales:'中村', version:'v2', updated:'2026-04-22', memo:'' },

  // 小田原製菓
  { id:'BAO-0233', name:'最中個包装フィルム',    client:'c05', spec:'PET/CPP / フルカラー / 防湿', qty:40000, unit_usd:0.05, total_jpy:326000, profit_pct:26.5, status:'quoting', delivery:'2026-07-01', factory:'—', sales:'佐藤', version:'v1', updated:'2026-04-10', memo:'' },
  { id:'BAO-0222', name:'進物用紙袋 中サイズ',    client:'c05', spec:'クラフト紙 / 1色 / 紐付', qty:5000, unit_usd:0.55, total_jpy:269200, profit_pct:38.0, status:'paid', delivery:'2026-05-20', factory:'広州PrimePack', sales:'佐藤', version:'v2', updated:'2026-04-12', memo:'' },

  // sanorè
  { id:'BAO-0234', name:'スキンケアBOX 30ml瓶用', client:'c06', spec:'特殊紙 / 箔押し / マットPP', qty:3000, unit_usd:1.95, total_jpy:572400, profit_pct:50.0, status:'quote_confirmed', delivery:'2026-06-20', factory:'杭州GreenBox', sales:'田中', version:'v2', updated:'2026-04-23', memo:'新ブランド立ち上げ' },
  { id:'BAO-0219', name:'コットンポーチ',        client:'c06', spec:'コットン100% / シルク印刷', qty:1000, unit_usd:1.20, total_jpy:117600, profit_pct:30.0, status:'delivered', delivery:'2026-03-15', factory:'広州PrimePack', sales:'田中', version:'v1', updated:'2026-03-18', memo:'' },
];

// Quantity variations per deal (same spec, different MOQ tiers)
// Adds: deal.variants = [{ qty, unit_usd, total_jpy, profit_pct, version }, ...]
// First variant matches the deal's main qty/price.
const VARIANT_FX = 155;
const COST_RATIO = 0.55;
function makeVariants(d) {
  const base = { qty:d.qty, unit_usd:d.unit_usd, total_jpy:d.total_jpy, profit_pct:d.profit_pct, version:d.version, note:'メイン' };
  const tiers = [];
  // Smaller tier (40-60% qty, +25% unit price)
  const small_qty = Math.round(d.qty * 0.5);
  const small_unit = +(d.unit_usd * 1.25).toFixed(4);
  const small_total = Math.round(small_qty * small_unit * VARIANT_FX / COST_RATIO);
  tiers.push({ qty:small_qty, unit_usd:small_unit, total_jpy:small_total, profit_pct:d.profit_pct - 4, version:d.version + 'a', note:'少量' });
  // Larger tier (180-220% qty, -10% unit price)
  const big_qty = Math.round(d.qty * 2);
  const big_unit = +(d.unit_usd * 0.9).toFixed(4);
  const big_total = Math.round(big_qty * big_unit * VARIANT_FX / COST_RATIO);
  tiers.push({ qty:big_qty, unit_usd:big_unit, total_jpy:big_total, profit_pct:d.profit_pct + 3, version:d.version + 'b', note:'大量' });
  return [tiers[0], base, tiers[1]];
}
for (const d of DEALS) d.variants = makeVariants(d);

// Derived/format helpers
const fmtJPY = (n) => '¥' + n.toLocaleString('ja-JP');
const fmtUSD = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSDsmall = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: n < 1 ? 3 : 2, maximumFractionDigits: 4 });
const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return `${d.getMonth()+1}/${d.getDate()}`;
};
const fmtDateLong = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
};
const daysUntil = (s) => {
  if (!s) return null;
  const d = new Date(s);
  const today = new Date('2026-04-25');
  return Math.round((d - today) / (1000*60*60*24));
};
const daysSince = (s) => {
  if (!s) return 0;
  const d = new Date(s);
  const today = new Date('2026-04-25');
  return Math.round((today - d) / (1000*60*60*24));
};
const clientById = (id) => CLIENTS.find(c => c.id === id) || { name:'—', short:'—' };
const factoryByName = (name) => FACTORIES_DATA.find(f => f.name === name);

// alerts
const isStale = (deal) => daysSince(deal.updated) >= 5 && deal.status !== 'delivered';
const isUrgent = (deal) => {
  const d = daysUntil(deal.delivery);
  return d !== null && d <= 14 && deal.status !== 'delivered';
};

// === StatusDot ===
function StatusDot({ status, size = 5 }) {
  const cfg = STATUS[status];
  return <span style={{ display:'inline-block', width:size, height:size, borderRadius:'50%', background:cfg.dot, flexShrink:0 }} />;
}

// === StatusPill (compact) ===
function StatusPill({ status }) {
  const cfg = STATUS[status];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontFamily:"'Zen Kaku Gothic New', sans-serif", fontSize:11, color:'#0a0a0a', whiteSpace:'nowrap' }}>
      <StatusDot status={status} />
      {cfg.label}
    </span>
  );
}

// === MiniProgress (7 segments) ===
function MiniProgress({ status }) {
  const idx = STATUS_ORDER.indexOf(status);
  return (
    <div style={{ display:'flex', gap:2, width:'100%' }}>
      {STATUS_ORDER.map((s, i) => (
        <div key={s} style={{
          flex:1, height:3, borderRadius:1.5,
          background: i < idx ? '#22c55e' : i === idx ? STATUS[s].dot : '#e8e8e6'
        }} />
      ))}
    </div>
  );
}

// === Tooltip with multi-currency ===
function MoneyHover({ jpy, usd, qty }) {
  const [hover, setHover] = React.useState(false);
  const cny = (usd * 7.18).toFixed(2);
  return (
    <span
      style={{ position:'relative', cursor:'help' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="num" style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>
        {fmtJPY(jpy)}
      </span>
      {hover && (
        <span style={{
          position:'absolute', bottom:'calc(100% + 4px)', right:0,
          background:'#0a0a0a', color:'#fff', borderRadius:6, padding:'6px 9px',
          fontSize:10, fontFamily:"'Zen Kaku Gothic New', sans-serif",
          whiteSpace:'nowrap', zIndex:10, lineHeight:1.5,
        }}>
          <div style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums' }}>USD {fmtUSD(usd*qty)}</div>
          <div style={{ fontFamily:"'Fraunces', serif", fontVariantNumeric:'tabular-nums', opacity:.7 }}>CNY ¥{cny} /個</div>
        </span>
      )}
    </span>
  );
}

// === DealThumb ===
// Auto-derives a small CSS-drawn thumbnail per deal based on its name keywords.
// Returns a tiny visual placeholder — bag / pouch / box / can / bottle / sticker / film.
function dealThumbKind(name) {
  const n = name || '';
  if (/缶/.test(n)) return 'can';
  if (/瓶|ボトル/.test(n)) return 'bottle';
  if (/シール|ラベル/.test(n)) return 'sticker';
  if (/箱|BOX|ボックス/i.test(n)) return 'box';
  if (/袋|パウチ|フィルム|個包装|小袋|ティーバッグ/.test(n)) return 'bag';
  if (/ポーチ/.test(n)) return 'pouch';
  return 'bag';
}
function dealThumbColor(deal) {
  // Pick color by client id so a client's deals share a palette
  const palette = {
    c01: ['#7c5e3c', '#d4b483'],  // 青葉珈琲 — coffee brown
    c02: ['#8b3a3a', '#c97064'],  // KURASHI 食品 — soy/red
    c03: ['#5e7c3c', '#a8c485'],  // mui tea — green
    c04: ['#c08a4a', '#e9c890'],  // TOKIWA Bakery — bread tan
    c05: ['#a8745a', '#d8b48b'],  // 小田原製菓 — wagashi
    c06: ['#7d6b8c', '#c9bcd6'],  // sanorè — cosmetic muted purple
  };
  return palette[deal.client] || ['#888', '#ccc'];
}

function DealThumb({ deal, size = 28, radius = 4 }) {
  const kind = dealThumbKind(deal.name);
  const [main, accent] = dealThumbColor(deal);
  const common = { width:size, height:size, borderRadius:radius, position:'relative', flexShrink:0, overflow:'hidden', background:'#fafaf9', border:'1px solid #f0f0ee', display:'inline-flex', alignItems:'center', justifyContent:'center' };
  if (kind === 'bag') {
    // Coffee/tea bag — top notch + body with stripe
    return (
      <span style={common} title={deal.name}>
        <span style={{ position:'absolute', left:'18%', right:'18%', top:'8%', height:'14%', background:main, borderRadius:'2px 2px 0 0', clipPath:'polygon(0 0, 100% 0, 88% 100%, 12% 100%)' }}></span>
        <span style={{ position:'absolute', left:'14%', right:'14%', top:'22%', bottom:'10%', background:main, borderRadius:'1px 1px 3px 3px' }}></span>
        <span style={{ position:'absolute', left:'14%', right:'14%', top:'52%', height:'10%', background:accent }}></span>
      </span>
    );
  }
  if (kind === 'pouch') {
    return (
      <span style={common} title={deal.name}>
        <span style={{ position:'absolute', left:'15%', right:'15%', top:'18%', bottom:'12%', background:main, borderRadius:'4px 4px 8px 8px' }}></span>
        <span style={{ position:'absolute', left:'15%', right:'15%', top:'18%', height:'8%', background:'rgba(0,0,0,0.2)', borderRadius:'4px 4px 0 0' }}></span>
      </span>
    );
  }
  if (kind === 'box') {
    return (
      <span style={common} title={deal.name}>
        <span style={{ position:'absolute', left:'18%', right:'18%', top:'22%', bottom:'18%', background:main, borderRadius:2 }}></span>
        <span style={{ position:'absolute', left:'18%', right:'18%', top:'22%', height:2, background:'rgba(255,255,255,0.4)' }}></span>
        <span style={{ position:'absolute', left:'48%', right:'48%', top:'22%', bottom:'18%', background:'rgba(0,0,0,0.15)' }}></span>
        <span style={{ position:'absolute', left:'34%', right:'34%', top:'42%', height:'14%', background:accent, borderRadius:1 }}></span>
      </span>
    );
  }
  if (kind === 'can') {
    return (
      <span style={common} title={deal.name}>
        <span style={{ position:'absolute', left:'24%', right:'24%', top:'14%', bottom:'14%', background:main, borderRadius:'30% / 12%' }}></span>
        <span style={{ position:'absolute', left:'24%', right:'24%', top:'40%', height:'14%', background:accent }}></span>
        <span style={{ position:'absolute', left:'24%', right:'24%', top:'14%', height:'10%', background:'rgba(255,255,255,0.5)', borderRadius:'30% / 80%' }}></span>
      </span>
    );
  }
  if (kind === 'bottle') {
    return (
      <span style={common} title={deal.name}>
        <span style={{ position:'absolute', left:'42%', right:'42%', top:'10%', height:'14%', background:main }}></span>
        <span style={{ position:'absolute', left:'30%', right:'30%', top:'22%', bottom:'12%', background:main, borderRadius:'3px 3px 5px 5px' }}></span>
        <span style={{ position:'absolute', left:'30%', right:'30%', top:'48%', height:'14%', background:accent }}></span>
      </span>
    );
  }
  if (kind === 'sticker') {
    return (
      <span style={common} title={deal.name}>
        <span style={{ position:'absolute', left:'22%', right:'22%', top:'22%', bottom:'22%', borderRadius:'50%', background:main, border:`1px dashed ${accent}` }}></span>
        <span style={{ position:'absolute', left:'40%', right:'40%', top:'40%', height:'20%', background:accent, borderRadius:1 }}></span>
      </span>
    );
  }
  return (
    <span style={common} title={deal.name}>
      <span style={{ width:'40%', height:'40%', background:main, borderRadius:2 }}></span>
    </span>
  );
}

Object.assign(window, {
  STATUS, STATUS_ORDER, CLIENTS, FACTORIES, FACTORIES_DATA, SALES, DEALS,
  fmtJPY, fmtUSD, fmtUSDsmall, fmtDate, fmtDateLong, daysUntil, daysSince, clientById, factoryByName,
  isStale, isUrgent,
  StatusDot, StatusPill, MiniProgress, MoneyHover, DealThumb,
});
