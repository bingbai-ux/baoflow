// Final integrated Home / Dashboard view
const fhStyles = {
  wrap: { flex:1, overflow:'auto', padding:'24px 28px 60px', background:'#fff' },
  greeting: { fontFamily:"'Fraunces', serif", fontSize:24, fontWeight:600, marginBottom:4, letterSpacing:'-0.01em' },
  greetingSub: { fontSize:12, color:'#888', marginBottom:24 },

  kpiRow: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 },
  kpi: { padding:16, border:'1px solid #e8e8e6', borderRadius:10, background:'#fafaf9' },
  kpiLabel: { fontSize:10, color:'#888', letterSpacing:'0.06em', textTransform:'uppercase', fontFamily:"'Fraunces', serif", fontWeight:600 },
  kpiVal: { fontFamily:"'Fraunces', serif", fontSize:26, fontWeight:600, marginTop:6, letterSpacing:'-0.01em' },
  kpiSub: { fontSize:10.5, color:'#888', marginTop:4 },
  kpiSubGreen: { color:'#3a7d36' },
  kpiSubRed: { color:'#c0392b' },

  twoCol: { display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:18, marginBottom:24 },
  card: { border:'1px solid #e8e8e6', borderRadius:10, background:'#fff' },
  cardHead: { padding:'12px 16px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' },
  cardTitle: { fontFamily:"'Fraunces', serif", fontSize:13, fontWeight:600 },
  cardSub: { fontSize:10, color:'#888' },

  pipeBar: { padding:'18px 16px 14px', display:'flex', alignItems:'flex-end', gap:0, height:140 },
  pipeCol: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%' },
  pipeColBar: { width:'80%', background:'#e8e8e6', borderRadius:'4px 4px 0 0', display:'flex', alignItems:'flex-end', justifyContent:'center', color:'#0a0a0a', fontFamily:"'Fraunces', serif", fontSize:11, fontWeight:600, paddingTop:6 },
  pipeColLabel: { fontSize:9.5, color:'#888', textAlign:'center' },

  attentionList: { padding:'4px 0' },
  attRow: { display:'flex', alignItems:'flex-start', gap:10, padding:'12px 16px', borderBottom:'1px solid #f5f4f0', cursor:'pointer', fontSize:11 },
  attDot: { width:8, height:8, borderRadius:'50%', marginTop:4, flexShrink:0 },
  attTitle: { fontWeight:500, color:'#0a0a0a', fontSize:11.5 },
  attMeta: { fontSize:10, color:'#888', marginTop:2 },
  attBadge: { fontSize:9.5, padding:'2px 6px', borderRadius:3, marginLeft:'auto', whiteSpace:'nowrap', fontFamily:"'Fraunces', serif", fontWeight:500 },
};

function FinalHome({ onOpenDeal, onNavigate }) {
  const today = new Date('2026-04-26');
  const totalActive = window.DEALS.filter(d => d.status !== 'delivered').length;
  const totalRevenue = window.DEALS.reduce((s,d) => s + d.total_jpy, 0);
  const avgProfit = window.DEALS.reduce((s,d) => s + d.profit_pct, 0) / window.DEALS.length;
  const urgent = window.DEALS.filter(d => {
    if (d.status === 'delivered') return false;
    const days = Math.round((new Date(d.delivery) - today) / 86400000);
    return days >= 0 && days <= 14;
  });
  const stalled = window.DEALS.filter(d => {
    if (d.status === 'delivered') return false;
    const days = Math.round((today - new Date(d.updated)) / 86400000);
    return days >= 7;
  });

  // Pipeline counts
  const pipeCounts = window.STATUS_ORDER.map(s => ({ s, label:window.STATUS[s].short, dot:window.STATUS[s].dot, count:window.DEALS.filter(d => d.status === s).length }));
  const maxCount = Math.max(...pipeCounts.map(p => p.count));

  return (
    <div style={fhStyles.wrap}>
      <div style={fhStyles.greeting}>おはようございます、田中さん</div>
      <div style={fhStyles.greetingSub}>4月26日 火曜日 · 今日の進行案件 {totalActive}件 · 要対応 {urgent.length + stalled.length}件</div>

      <div style={fhStyles.kpiRow}>
        <div style={fhStyles.kpi}>
          <div style={fhStyles.kpiLabel}>進行中の案件</div>
          <div style={fhStyles.kpiVal}>{totalActive}</div>
          <div style={fhStyles.kpiSub}>うち今月納品予定 {window.DEALS.filter(d => d.delivery.startsWith('2026-04')).length}件</div>
        </div>
        <div style={fhStyles.kpi}>
          <div style={fhStyles.kpiLabel}>今月の売上見込</div>
          <div style={fhStyles.kpiVal}>{window.fmtJPY(Math.round(totalRevenue/3))}</div>
          <div style={{ ...fhStyles.kpiSub, ...fhStyles.kpiSubGreen }}>↑ 前月比 +18.2%</div>
        </div>
        <div style={fhStyles.kpi}>
          <div style={fhStyles.kpiLabel}>平均粗利率</div>
          <div style={fhStyles.kpiVal}>{avgProfit.toFixed(1)}%</div>
          <div style={fhStyles.kpiSub}>目標 35.0% · {avgProfit >= 35 ? '達成中' : '未達'}</div>
        </div>
        <div style={fhStyles.kpi}>
          <div style={fhStyles.kpiLabel}>要対応</div>
          <div style={fhStyles.kpiVal}>{urgent.length + stalled.length}</div>
          <div style={{ ...fhStyles.kpiSub, ...fhStyles.kpiSubRed }}>納期15日以内 {urgent.length}件 · 停滞 {stalled.length}件</div>
        </div>
      </div>

      <div style={fhStyles.twoCol}>
        <div style={fhStyles.card}>
          <div style={fhStyles.cardHead}>
            <div style={fhStyles.cardTitle}>パイプライン</div>
            <div style={fhStyles.cardSub} onClick={() => onNavigate('deals')} >案件一覧へ →</div>
          </div>
          <div style={fhStyles.pipeBar}>
            {pipeCounts.map(p => (
              <div key={p.s} style={fhStyles.pipeCol}>
                <div style={{ ...fhStyles.pipeColBar, height:`${maxCount > 0 ? (p.count/maxCount)*100 : 0}%`, background:p.dot, color: ['#bbbbbb','#888888','#e0dfd9'].includes(p.dot) ? '#0a0a0a' : '#fff', minHeight:p.count > 0 ? 28 : 4 }}>
                  {p.count}
                </div>
                <div style={fhStyles.pipeColLabel}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={fhStyles.card}>
          <div style={fhStyles.cardHead}>
            <div style={fhStyles.cardTitle}>要対応リスト</div>
            <div style={fhStyles.cardSub}>{urgent.length + stalled.length}件</div>
          </div>
          <div style={fhStyles.attentionList}>
            {urgent.slice(0,3).map(d => {
              const days = Math.round((new Date(d.delivery) - today) / 86400000);
              return (
                <div key={d.id} style={fhStyles.attRow} onClick={() => onOpenDeal(d)}>
                  <span style={{ ...fhStyles.attDot, background:'#c0392b' }}></span>
                  <div style={{ flex:1 }}>
                    <div style={fhStyles.attTitle}>{d.name}</div>
                    <div style={fhStyles.attMeta}>{d.id} · {(window.CLIENTS.find(c=>c.id===d.client)||{}).short} · 納期 {window.fmtDate(d.delivery)}</div>
                  </div>
                  <span style={{ ...fhStyles.attBadge, background:'#fdeae3', color:'#c0392b' }}>あと {days}日</span>
                </div>
              );
            })}
            {stalled.slice(0,3).map(d => {
              const days = Math.round((today - new Date(d.updated)) / 86400000);
              return (
                <div key={d.id} style={fhStyles.attRow} onClick={() => onOpenDeal(d)}>
                  <span style={{ ...fhStyles.attDot, background:'#e0a132' }}></span>
                  <div style={{ flex:1 }}>
                    <div style={fhStyles.attTitle}>{d.name}</div>
                    <div style={fhStyles.attMeta}>{d.id} · {(window.CLIENTS.find(c=>c.id===d.client)||{}).short} · {window.STATUS[d.status].label}で停滞</div>
                  </div>
                  <span style={{ ...fhStyles.attBadge, background:'#fbf3df', color:'#a8782e' }}>{days}日停滞</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={fhStyles.twoCol}>
        <div style={fhStyles.card}>
          <div style={fhStyles.cardHead}>
            <div style={fhStyles.cardTitle}>クライアント別 売上</div>
            <div style={fhStyles.cardSub}>過去90日</div>
          </div>
          <div style={{ padding:14 }}>
            {window.CLIENTS.map(c => {
              const cd = window.DEALS.filter(d => d.client === c.id);
              const tot = cd.reduce((s,d) => s + d.total_jpy, 0);
              const max = Math.max(...window.CLIENTS.map(cl => window.DEALS.filter(d => d.client === cl.id).reduce((s,d) => s + d.total_jpy, 0)));
              return (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', fontSize:11.5 }}>
                  <div style={{ width:120, color:'#0a0a0a' }}>{c.short}</div>
                  <div style={{ flex:1, height:8, background:'#fafaf9', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${(tot/max)*100}%`, background:'#0a0a0a' }}></div>
                  </div>
                  <div style={{ width:80, textAlign:'right', fontFamily:"'Fraunces', serif", fontWeight:500, fontSize:11 }}>{window.fmtJPY(tot)}</div>
                  <div style={{ width:30, textAlign:'right', fontSize:9.5, color:'#888', fontFamily:"'Fraunces', serif" }}>{cd.length}件</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={fhStyles.card}>
          <div style={fhStyles.cardHead}>
            <div style={fhStyles.cardTitle}>最近の活動</div>
            <div style={fhStyles.cardSub}>すべて表示 →</div>
          </div>
          <div style={{ padding:'4px 0' }}>
            {[
              { who:'田中', when:'10分前', text:'BAO-0231 のステータスを「製作中」に変更' },
              { who:'佐藤', when:'2時間前', text:'BAO-0230 に発注書を生成 (蘇州ZHL宛)' },
              { who:'システム', when:'3時間前', text:'BAO-0224 出荷通知 (追跡番号 YT81234567CN)' },
              { who:'林', when:'昨日', text:'BAO-0232 ティーバッグ袋に大量ロット案を追加' },
              { who:'中村', when:'昨日', text:'TOKIWA Bakeryに新規案件 BAO-0235 を作成' },
            ].map((a, i) => (
              <div key={i} style={{ padding:'10px 16px', borderBottom:'1px solid #f5f4f0', fontSize:11, display:'flex', gap:10 }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:'#fafaf9', color:'#888', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{a.who.charAt(0)}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:'#444' }}>{a.text}</div>
                  <div style={{ color:'#aaa', fontSize:9.5, marginTop:2, fontFamily:"'Fraunces', serif" }}>{a.who} · {a.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.FinalHome = FinalHome;
