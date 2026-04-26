// Final integrated app shell — Phase A+B+C
// Combines: global nav · view switcher · always-on right pane · cmd+k · notifications · doc generator integrated

const shStyles = {
  app: { display:'flex', height:'100vh', width:'100%', background:'#f6f5f2', fontFamily:"'Zen Kaku Gothic New', sans-serif", color:'#0a0a0a', overflow:'hidden' },
  // Left nav rail
  nav: { width:64, background:'#0a0a0a', display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 0 14px', flexShrink:0, gap:4 },
  navLogo: { width:32, height:32, borderRadius:8, background:'#f6f5f2', color:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Fraunces', serif", fontWeight:700, fontSize:16, marginBottom:18 },
  navItem: { width:44, height:44, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative', color:'#777' },
  navItemActive: { background:'rgba(255,255,255,0.10)', color:'#fff' },
  navItemHover: { color:'#bbb' },
  navLabel: { position:'absolute', left:54, top:'50%', transform:'translateY(-50%)', background:'#0a0a0a', color:'#fff', padding:'5px 10px', borderRadius:6, fontSize:11, whiteSpace:'nowrap', pointerEvents:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.3)', zIndex:200 },
  navBadge: { position:'absolute', top:6, right:6, background:'#e74c3c', color:'#fff', fontSize:9, fontFamily:"'Fraunces', serif", fontWeight:700, borderRadius:8, padding:'1px 5px', minWidth:14, textAlign:'center' },
  navSpacer: { flex:1 },

  // Main column
  main: { flex:1, display:'flex', flexDirection:'column', minWidth:0, background:'#f6f5f2' },

  // Top bar
  topbar: { height:52, padding:'0 20px', display:'flex', alignItems:'center', gap:14, borderBottom:'1px solid #e8e8e6', background:'#f6f5f2', flexShrink:0 },
  pageTitle: { fontFamily:"'Fraunces', serif", fontSize:17, fontWeight:600, letterSpacing:'-0.01em' },
  pageSub: { fontSize:11, color:'#888', marginLeft:8 },
  topSpacer: { flex:1 },
  search: { display:'flex', alignItems:'center', gap:8, padding:'7px 12px', border:'1px solid #e0dfd9', borderRadius:8, background:'#fff', cursor:'pointer', minWidth:280, color:'#888', fontSize:12 },
  searchKbd: { marginLeft:'auto', fontSize:10, color:'#aaa', background:'#fafaf9', border:'1px solid #e8e8e6', borderRadius:4, padding:'1px 6px', fontFamily:'monospace' },
  ccyToggle: { display:'flex', border:'1px solid #e0dfd9', borderRadius:8, overflow:'hidden', background:'#fff' },
  ccyBtn: { padding:'6px 12px', fontSize:11, fontFamily:"'Fraunces', serif", fontWeight:600, cursor:'pointer', background:'transparent', border:'none', color:'#888' },
  ccyBtnActive: { background:'#0a0a0a', color:'#fff' },
  iconBtn: { width:34, height:34, borderRadius:8, border:'1px solid #e0dfd9', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' },
  primaryBtn: { padding:'7px 14px', borderRadius:8, background:'#0a0a0a', color:'#fff', border:'none', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit' },

  // Content area
  content: { flex:1, display:'flex', minHeight:0 },
  centerCol: { flex:1, display:'flex', flexDirection:'column', minWidth:0 },

  // View switcher tabs
  viewTabs: { display:'flex', gap:0, padding:'0 20px', borderBottom:'1px solid #e8e8e6', background:'#fafaf9', flexShrink:0 },
  viewTab: { padding:'10px 14px', fontSize:12, color:'#777', cursor:'pointer', borderBottom:'2px solid transparent', display:'flex', alignItems:'center', gap:6 },
  viewTabActive: { color:'#0a0a0a', fontWeight:600, borderBottomColor:'#0a0a0a' },
  viewSpacer: { flex:1 },
  viewMeta: { padding:'0 14px', fontSize:11, color:'#888', alignSelf:'center' },

  // Right pane
  pane: { width:420, borderLeft:'1px solid #e8e8e6', background:'#fff', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' },
  paneEmpty: { flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'#bbb', fontSize:11, padding:24, textAlign:'center' },
  paneEmptyIcon: { fontSize:32, fontFamily:"'Fraunces', serif", color:'#ddd' },

  // Toast
  toast: { position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#0a0a0a', color:'#fff', padding:'10px 18px', borderRadius:10, fontSize:12, boxShadow:'0 8px 24px rgba(0,0,0,0.2)', zIndex:1500, display:'flex', alignItems:'center', gap:10 },
};

// Simple icons
const NavIcon = ({ k, active }) => {
  const c = active ? '#fff' : '#777';
  const sw = 1.6;
  if (k === 'home') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw}><path d="M3 12l9-8 9 8M5 10v10h14V10"/></svg>;
  if (k === 'deals') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M8 5v14"/></svg>;
  if (k === 'master') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw}><path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/></svg>;
  if (k === 'docs') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 13h6M9 17h6"/></svg>;
  if (k === 'bell') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>;
  if (k === 'settings') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
  if (k === 'plus') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 5v14M5 12h14"/></svg>;
  if (k === 'search') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={1.8}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>;
  return null;
};

window.NavIcon = NavIcon;
window.shStyles = shStyles;

// Notification list (mock)
const NOTIFICATIONS = [
  { id:'n1', icon:'⚠', title:'BAO-0231 納期15日切迫', body:'ドリップバッグ袋 春版 — 5/12納品予定。工場確認を', when:'10分前', deal:'BAO-0231', urgent:true },
  { id:'n2', icon:'●', title:'BAO-0227 状態が停滞', body:'製作中のまま8日経過 — 工場へリマインド', when:'2時間前', deal:'BAO-0227' },
  { id:'n3', icon:'✓', title:'BAO-0224 出荷完了', body:'東莞XY印刷から発送通知（追跡番号YT81234567CN）', when:'昨日', deal:'BAO-0224' },
  { id:'n4', icon:'$', title:'BAO-0230 入金確認', body:'KURASHI 食品から¥294,000の入金を確認', when:'昨日', deal:'BAO-0230' },
  { id:'n5', icon:'@', title:'佐藤さんからメンション', body:'BAO-0220 「次回ロットは色味確認お願いします」', when:'2日前', deal:'BAO-0220' },
];

window.NOTIFICATIONS = NOTIFICATIONS;
