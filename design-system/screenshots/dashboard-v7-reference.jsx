import { useState } from "react";

/* ═══════════════════════════════════════════════════════════
   BAOFlow Dashboard v7 — Final Design System
   ═══════════════════════════════════════════════════════════
   Typography:
     Display/EN : Fraunces (variable, optical size)
     Body/JA    : Zen Kaku Gothic New
     Numbers    : Fraunces tabular-nums
   
   Colors: Monochrome + #22c55e green accent
   Layout: 8px gap, 20px radius cards
   ═══════════════════════════════════════════════════════════ */

// ── Design Tokens ──────────────────────────────────────────
const C = {
  bg: "#f2f2f0",
  card: "#ffffff",
  cardHover: "#fcfcfb",
  border: "rgba(0,0,0,0.06)",
  borderSolid: "#e8e8e6",
  green: "#22c55e",
  greenDark: "#15803d",
  black: "#0a0a0a",
  text: "#0a0a0a",
  mid: "#555",
  sub: "#888",
  light: "#bbb",
  mute: "#ddd",
};

const R = 20;
const G = 8;

// Typography
const FD = "'Fraunces', serif";                                    // Display / EN headings
const FJ = "'Zen Kaku Gothic New', system-ui, sans-serif";        // Body / JA
const FB = `'Zen Kaku Gothic New', 'Fraunces', system-ui, sans-serif`; // Mixed body
const TN = { fontVariantNumeric: "tabular-nums" };                // Number alignment

// ── Data ──────────────────────────────────────────────────
const orders = [
  { id: "BAO-0231", client: "ROAST WORKS", product: "コーヒーカップ 12oz", qty: "10,000", factory: "深圳包装有限公司", status: "製造中", date: "2026-02-28", amount: "¥1,240,000" },
  { id: "BAO-0228", client: "Patisserie MORI", product: "ギフトボックス A4", qty: "5,000", factory: "東莞紙品有限公司", status: "見積中", date: "2026-03-15", amount: "¥890,000" },
  { id: "BAO-0225", client: "gelato BENE", product: "アイスカップ 280ml", qty: "20,000", factory: "深圳包装有限公司", status: "納品完了", date: "2026-01-20", amount: "¥2,680,000" },
  { id: "BAO-0222", client: "抹茶一期", product: "抹茶缶 100g", qty: "3,000", factory: "広州金属罐有限公司", status: "仕様確定", date: "2026-03-01", amount: "¥540,000" },
  { id: "BAO-0218", client: "Burger CRAFT", product: "レジ袋 M", qty: "50,000", factory: "義烏塑料有限公司", status: "入金待ち", date: "2026-02-15", amount: "¥380,000" },
  { id: "BAO-0215", client: "ROAST WORKS", product: "コーヒー蓋 12oz", qty: "10,000", factory: "深圳包装有限公司", status: "配送中", date: "2026-02-10", amount: "¥620,000" },
  { id: "BAO-0210", client: "Boulangerie Soir", product: "化粧箱 ケーキ用", qty: "8,000", factory: "東莞紙品有限公司", status: "製造中", date: "2026-02-25", amount: "¥1,560,000" },
  { id: "BAO-0205", client: "gelato BENE", product: "スプーン 木製", qty: "30,000", factory: "義烏塑料有限公司", status: "納品完了", date: "2026-01-30", amount: "¥210,000" },
];

const statusMap = {
  "見積中": { dot: C.light },
  "仕様確定": { dot: C.green },
  "入金待ち": { dot: "#e5a32e" },
  "製造中": { dot: C.black },
  "配送中": { dot: C.sub },
  "納品完了": { dot: C.green },
};

const pipeline = [
  { stage: "見積依頼", count: 4 },
  { stage: "仕様確定", count: 3 },
  { stage: "入金待ち", count: 2 },
  { stage: "製造中", count: 5 },
  { stage: "配送中", count: 2 },
  { stage: "納品完了", count: 12 },
];

// ── Primitives ─────────────────────────────────────────────
const Card = ({ children, style, ...p }) => (
  <div style={{ background: C.card, borderRadius: R, border: `1px solid ${C.border}`, ...style }} {...p}>{children}</div>
);

// Display number: Fraunces with comma-split and superscript unit
const BigNum = ({ integer, decimal, unit = "%", size = 44 }) => (
  <div style={{ fontFamily: FD, fontWeight: 500, fontSize: size, letterSpacing: "-0.03em", lineHeight: 1, color: C.text, display: "flex", alignItems: "flex-start", ...TN }}>
    {integer}<span style={{ fontSize: size * 0.5, letterSpacing: 0 }}>,{decimal}</span>
    <span style={{ fontSize: size * 0.3, fontWeight: 400, color: C.sub, marginTop: 2, marginLeft: 1 }}>{unit}</span>
  </div>
);

const SmallLabel = ({ children }) => (
  <span style={{ fontSize: 11, color: C.sub, fontFamily: FJ, fontWeight: 400 }}>{children}</span>
);

const SmallVal = ({ children }) => (
  <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FD, ...TN }}>{children}</span>
);

const CardLabel = ({ icon, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 0 }}>
    {icon}
    <span style={{ fontSize: 12.5, fontWeight: 500, color: C.sub, fontFamily: FJ }}>{children}</span>
  </div>
);

// ── SVG Charts ─────────────────────────────────────────────
function BarcodeBars({ data, w = 160, h = 28, darkColor = C.black, highlightColor = C.green, highlightLast = 2 }) {
  const max = Math.max(...data);
  const barW = Math.max(1.5, (w - data.length * 0.8) / data.length);
  const gap = 0.8;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {data.map((v, i) => {
        const bh = Math.max(1, (v / max) * h);
        const isHL = i >= data.length - highlightLast;
        return <rect key={i} x={i * (barW + gap)} y={h - bh} width={barW} height={bh} fill={isHL ? highlightColor : darkColor} opacity={isHL ? 1 : 0.12} rx={0.5} />;
      })}
    </svg>
  );
}

function CandleChart({ data, w = 260, h = 60 }) {
  const max = Math.max(...data.map(d => d.h));
  const min = Math.min(...data.map(d => d.l));
  const range = max - min || 1;
  const barW = Math.max(1, (w - data.length * 1.5) / data.length);
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {data.map((d, i) => {
        const x = i * (barW + 1.5);
        const yH = h - ((d.h - min) / range) * (h - 4) - 2;
        const yL = h - ((d.l - min) / range) * (h - 4) - 2;
        const yO = h - ((d.o - min) / range) * (h - 4) - 2;
        const yC = h - ((d.c - min) / range) * (h - 4) - 2;
        const up = d.c >= d.o;
        return (
          <g key={i}>
            <line x1={x + barW/2} y1={yH} x2={x + barW/2} y2={yL} stroke={up ? C.green : C.black} strokeWidth={0.8} opacity={0.4} />
            <rect x={x} y={Math.min(yO, yC)} width={barW} height={Math.max(1, Math.abs(yC - yO))} fill={up ? C.green : C.black} opacity={up ? 0.7 : 0.15} rx={0.3} />
          </g>
        );
      })}
    </svg>
  );
}

function Gauge({ value = 72, size = 120 }) {
  const sw = 6;
  const r = (size - sw) / 2;
  const circ = Math.PI * r;
  const filled = circ * (value / 100);
  const dotAngle = Math.PI * (1 - value / 100);
  const dotX = size / 2 + r * Math.cos(dotAngle);
  const dotY = size / 2 - r * Math.sin(dotAngle);
  return (
    <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.65}`} style={{ display: "block" }}>
      <path d={`M ${sw/2} ${size/2} A ${r} ${r} 0 0 1 ${size - sw/2} ${size/2}`} fill="none" stroke={C.borderSolid} strokeWidth={sw} strokeLinecap="round" />
      {Array.from({ length: 21 }).map((_, i) => {
        const angle = Math.PI - (i / 20) * Math.PI;
        const x1 = size/2 + (r + 8) * Math.cos(angle);
        const y1 = size/2 - (r + 8) * Math.sin(angle);
        const x2 = size/2 + (r + 12) * Math.cos(angle);
        const y2 = size/2 - (r + 12) * Math.sin(angle);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.mute} strokeWidth={i % 5 === 0 ? 1.5 : 0.8} />;
      })}
      <path d={`M ${sw/2} ${size/2} A ${r} ${r} 0 0 1 ${size - sw/2} ${size/2}`} fill="none" stroke="#ccc" strokeWidth={sw} strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
      <circle cx={dotX} cy={dotY} r={5} fill={C.green} />
    </svg>
  );
}

// ── Icon helper ────────────────────────────────────────────
const I = (d, s = 15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
const Iexp = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.light} strokeWidth="1.8" strokeLinecap="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>;

// ── Insight Banner ─────────────────────────────────────────
function InsightBanner() {
  return (
    <div style={{
      position: "relative", borderRadius: R, overflow: "hidden", height: 185,
      background: "linear-gradient(140deg, rgba(34,197,94,0.22) 0%, rgba(34,197,94,0.40) 35%, rgba(22,163,74,0.28) 60%, rgba(34,197,94,0.12) 100%)",
    }}>
      {[
        { top: -10, right: 40, rotate: "2deg", opacity: 0.35, z: 1 },
        { top: 5, right: 80, rotate: "-3deg", opacity: 0.25, z: 0 },
        { top: -5, right: 10, rotate: "5deg", opacity: 0.20, z: 2 },
      ].map((c, i) => (
        <div key={i} style={{
          position: "absolute", top: c.top, right: c.right, width: 200, height: 140,
          borderRadius: 16, background: `rgba(255,255,255,${c.opacity})`,
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.35)",
          transform: `rotate(${c.rotate})`, zIndex: c.z,
        }}>
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.3)", fontFamily: FD }}>...mation</div>
            <div style={{ fontSize: 10, color: "rgba(0,0,0,0.25)", fontFamily: FJ, marginTop: 4 }}>...savings</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" style={{ position: "absolute", top: 12, right: 12 }}>
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
          </svg>
        </div>
      ))}

      <div style={{ position: "relative", zIndex: 5, padding: "26px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1l2.2 4.4 4.8.7-3.5 3.4.8 4.8L8 11.8l-4.3 2.5.8-4.8-3.5-3.4 4.8-.7z" fill={C.greenDark}/></svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.greenDark, fontFamily: FD }}>Account Insights</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.greenDark} strokeWidth="2" strokeLinecap="round" style={{ marginLeft: 4 }}><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
        </div>
        <p style={{ fontSize: 26, fontWeight: 700, color: C.text, lineHeight: 1.32, margin: 0, fontFamily: FJ, maxWidth: 360 }}>
          先月の自動化で処理時間を <span style={{ fontFamily: FD, fontWeight: 600, fontSize: 28, ...TN }}>48.3</span> 時間短縮
        </p>
      </div>

      <div style={{ position: "absolute", bottom: 20, left: 30, display: "flex", gap: 6, zIndex: 5 }}>
        <span style={{ width: 22, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.45)" }} />
        <span style={{ width: 8, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.12)" }} />
        <span style={{ width: 8, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.12)" }} />
      </div>
    </div>
  );
}

// ── KPI Cards ──────────────────────────────────────────────
function CardRevenue() {
  const bars = [3,5,2,4,6,3,5,7,4,6,8,5,7,4,6,5,7,3,8,6,4,7,5,8,6,4,7,9,5,8];
  return (
    <Card style={{ padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 200 }}>
      <CardLabel icon={I("M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6")}>月間売上</CardLabel>
      <BigNum integer="24" decimal="80" unit="M¥" size={44} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <div><SmallVal>14.9M</SmallVal><br/><SmallLabel>前月</SmallLabel></div>
        <div style={{ textAlign: "right" }}><SmallVal>+12%</SmallVal><br/><SmallLabel>増減率</SmallLabel></div>
      </div>
      <div style={{ marginTop: 8 }}><BarcodeBars data={bars} w={200} h={22} /></div>
    </Card>
  );
}

function CardProgress() {
  return (
    <Card style={{ padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 200 }}>
      <CardLabel icon={I("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2")}>案件進捗</CardLabel>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div><SmallVal>174</SmallVal><br/><SmallLabel>確定済</SmallLabel></div>
        <div style={{ textAlign: "right" }}><SmallVal>31</SmallVal><br/><SmallLabel>未確定</SmallLabel></div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", margin: "4px 0" }}>
        <Gauge value={72} size={130} />
        <div style={{ fontFamily: FD, fontSize: 26, fontWeight: 500, letterSpacing: "-0.03em", color: C.text, marginTop: -4, display: "flex", alignItems: "flex-start", ...TN }}>
          71<span style={{ fontSize: 14 }}>,74</span><span style={{ fontSize: 10, color: C.sub, marginTop: 2, marginLeft: 1 }}>%</span>
        </div>
      </div>
    </Card>
  );
}

function CardRisk() {
  const bars = [2,4,1,3,5,2,4,6,3,5,7,4,6,3,5,4,6,2,7,5,3,6,4,7,5,3,6,8,4,7];
  return (
    <Card style={{ padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 200 }}>
      <CardLabel icon={I("M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01")}>遅延リスク</CardLabel>
      <BigNum integer="10" decimal="12" unit="%" size={44} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <div><SmallVal>1.62k</SmallVal><br/><SmallLabel>検出</SmallLabel></div>
        <div style={{ textAlign: "right" }}><SmallVal>13.7k</SmallVal><br/><SmallLabel>全案件</SmallLabel></div>
      </div>
      <div style={{ marginTop: 8 }}><BarcodeBars data={bars} w={200} h={22} /></div>
    </Card>
  );
}

function CardAI() {
  return (
    <Card style={{ padding: "20px 22px", display: "flex", flexDirection: "column", minHeight: 200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <CardLabel icon={I("M12 2a5 5 0 015 5v3H7V7a5 5 0 015-5zM3 12h18v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z")}>AI Assistant</CardLabel>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.light} strokeWidth="1.8"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, fontFamily: FD, color: C.mid, ...TN }}>TK</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FD }}>Takeshi K.</div>
          <div style={{ fontSize: 11.5, color: C.mid, fontFamily: FJ, lineHeight: 1.45, marginTop: 3 }}>深圳工場の納期遅延を分析して</div>
          <div style={{ fontSize: 10, fontFamily: FD, color: C.light, marginTop: 4, ...TN }}>ID: #6287439</div>
        </div>
        <div style={{ fontSize: 10, color: C.light, fontFamily: FD, marginLeft: "auto", flexShrink: 0, ...TN }}>10:12</div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${C.green}22, ${C.green}44)`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.greenDark} strokeWidth="1.8"><path d="M12 2a5 5 0 015 5v3H7V7a5 5 0 015-5zM3 12h18v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FD }}>BAO AI</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: C.text, fontFamily: FJ, marginTop: 3 }}>Main Deviations by Month:</div>
          {[["7月", "¥18.9K"], ["8月", "¥21.7K"], ["9月", "¥11.9K"]].map(([m, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: i < 2 ? C.green : C.text }} />
                <span style={{ fontSize: 11.5, color: C.mid, fontFamily: FJ }}>{m}</span>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 600, fontFamily: FD, color: C.text, ...TN }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: C.light, fontFamily: FD, flexShrink: 0, ...TN }}>10:13</div>
      </div>
    </Card>
  );
}

// ── Wide Cards ─────────────────────────────────────────────
function CardUtilization() {
  const data = Array.from({length:35}, () => ({ h: 30+Math.random()*40, l: 5+Math.random()*20, o: 15+Math.random()*30, c: 15+Math.random()*30 }));
  return (
    <Card style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <CardLabel icon={I("M2 3h20v14H2zM8 21h8M12 17v4")}>工場稼働率</CardLabel>
        {Iexp}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div><SmallVal>65%</SmallVal><br/><SmallLabel>稼働</SmallLabel></div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 16 }}><span style={{ fontSize: 10, color: C.light, fontFamily: FD }}>Average Account Stats</span></div>
        </div>
        <div><SmallVal>34%</SmallVal><br/><SmallLabel>手動</SmallLabel></div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 2 }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <span style={{ fontFamily: FD, fontSize: 36, fontWeight: 500, letterSpacing: "-0.03em", color: C.text, lineHeight: 1, ...TN }}>56</span>
          <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 500, color: C.text, lineHeight: 1, ...TN }}>,1</span>
          <span style={{ fontSize: 12, color: C.sub, marginTop: 2, marginLeft: 1, fontFamily: FD }}>%</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ textAlign: "right" }}><SmallVal>82%</SmallVal><br/><SmallLabel>自動化</SmallLabel></div>
          <div style={{ textAlign: "right" }}><SmallVal>12%</SmallVal><br/><SmallLabel>Autosync</SmallLabel></div>
        </div>
      </div>
      <CandleChart data={data} w={380} h={50} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: C.light, fontFamily: FD, ...TN }}>Jun</span>
        <span style={{ fontSize: 10, color: C.light, fontFamily: FD, ...TN }}>Jul</span>
      </div>
    </Card>
  );
}

function CardTimely() {
  const data = Array.from({length:35}, () => ({ h: 30+Math.random()*40, l: 5+Math.random()*20, o: 15+Math.random()*30, c: 15+Math.random()*30 }));
  return (
    <Card style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <CardLabel icon={I("M3 4h18v18H3zM16 2v4M8 2v4M3 10h18")}>納期遵守率</CardLabel>
        {Iexp}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div><SmallVal>84</SmallVal><br/><SmallLabel>完了</SmallLabel></div>
          <div><SmallVal>24%</SmallVal><br/><SmallLabel>進行中</SmallLabel></div>
        </div>
        <div><SmallVal>84/0%</SmallVal><br/><SmallLabel>OnTime</SmallLabel></div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 2 }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <span style={{ fontFamily: FD, fontSize: 36, fontWeight: 500, letterSpacing: "-0.03em", color: C.text, lineHeight: 1, ...TN }}>82</span>
          <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 500, color: C.text, lineHeight: 1, ...TN }}>,6</span>
          <span style={{ fontSize: 12, color: C.sub, marginTop: 2, marginLeft: 1, fontFamily: FD }}>%</span>
        </div>
        <div style={{ flex: 1 }} />
        <div><SmallVal>19/5</SmallVal><br/><SmallLabel>Timely</SmallLabel></div>
      </div>
      <CandleChart data={data} w={380} h={50} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: C.light, fontFamily: FD, ...TN }}>Jun</span>
        <span style={{ fontSize: 10, color: C.light, fontFamily: FD, ...TN }}>Jul</span>
      </div>
    </Card>
  );
}

// ── Contact Row ────────────────────────────────────────────
function ContactRow() {
  const contacts = [
    { name: "深圳包装有限公司", email: "sz-pack@factory.cn" },
    { name: "東莞紙品有限公司", email: "dg-paper@factory.cn" },
    { name: "広州金属罐有限公司", email: "gz-metal@factory.cn" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: G }}>
      {contacts.map((c, i) => (
        <Card key={i} style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {I("M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8", 14)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FJ, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
            <div style={{ fontSize: 11, color: C.light, fontFamily: FD }}>{c.email}</div>
          </div>
          {Iexp}
        </Card>
      ))}
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────────────
function OverviewTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: G }}>
      <InsightBanner />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: G }}>
        <CardRevenue /><CardProgress /><CardRisk /><CardAI />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: G }}>
        <CardUtilization />
        <CardTimely />
        <Card style={{ padding: "20px 22px", display: "flex", flexDirection: "column" }}>
          <CardLabel icon={I("M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01")}>パイプライン</CardLabel>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 9, marginTop: 8 }}>
            {pipeline.map((p, i) => {
              const total = pipeline.reduce((s, d) => s + d.count, 0);
              const pct = (p.count / total) * 100;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.sub, fontFamily: FJ, width: 50, textAlign: "right", flexShrink: 0 }}>{p.stage}</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: C.bg, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: i === pipeline.length - 1 ? C.green : C.black, opacity: i === pipeline.length - 1 ? 0.7 : 0.10 + i * 0.04 }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: FD, color: C.mid, width: 16, textAlign: "right", ...TN }}>{p.count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <ContactRow />
    </div>
  );
}

// ── Orders Tab ─────────────────────────────────────────────
function OrdersTab() {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "見積中", "製造中", "配送中", "納品完了"];
  const filtered = filter === "All" ? orders : orders.filter(o => o.status === filter);
  return (
    <Card style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: FD }}>Orders</span>
          <div style={{ display: "flex", gap: 4 }}>
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                border: `1px solid ${filter === f ? C.black : C.borderSolid}`, borderRadius: 8,
                padding: "5px 13px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: FJ,
                background: filter === f ? C.black : C.card, color: filter === f ? "#fff" : C.sub, transition: "all 0.15s",
              }}>{f}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.borderSolid}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {I("M21 21l-4.35-4.35M11 3a8 8 0 100 16 8 8 0 000-16", 14)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.borderSolid}`, borderRadius: 10, padding: "6px 12px" }}>
            {I("M3 4h18v18H3zM16 2v4M8 2v4M3 10h18", 13)}
            <span style={{ fontSize: 11.5, color: C.mid, fontFamily: FD, ...TN }}>Jan 1, 2026 – Feb 7, 2026</span>
          </div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
          {["案件ID", "クライアント", "製品", "数量", "工場", "Status", "納期", "金額"].map(h => (
            <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 500, color: C.light, fontFamily: FJ }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>{filtered.map((o, i) => (
          <tr key={o.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer", transition: "background 0.12s" }}
            onMouseOver={e => e.currentTarget.style.background = C.cardHover}
            onMouseOut={e => e.currentTarget.style.background = "transparent"}>
            <td style={{ padding: "12px 14px", fontSize: 12, fontFamily: FD, color: C.light, ...TN }}>{o.id}</td>
            <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FD }}>{o.client}</td>
            <td style={{ padding: "12px 14px", fontSize: 12, color: C.sub, fontFamily: FJ }}>{o.product}</td>
            <td style={{ padding: "12px 14px", fontSize: 12, fontFamily: FD, color: C.sub, ...TN }}>{o.qty}</td>
            <td style={{ padding: "12px 14px", fontSize: 11, color: C.light, fontFamily: FJ }}>{o.factory}</td>
            <td style={{ padding: "12px 14px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.mid, fontFamily: FJ }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusMap[o.status]?.dot || "#ccc" }} />{o.status}
              </span>
            </td>
            <td style={{ padding: "12px 14px", fontSize: 12, fontFamily: FD, color: C.sub, ...TN }}>{o.date}</td>
            <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, fontFamily: FD, color: C.text, textAlign: "right", ...TN }}>{o.amount}</td>
          </tr>
        ))}</tbody>
      </table>
    </Card>
  );
}

// ── Settings Tab ───────────────────────────────────────────
function SettingsTab() {
  const [toggles, setToggles] = useState({ a: true, b: false, c: true, d: false, e: true });
  const toggle = k => setToggles(p => ({ ...p, [k]: !p[k] }));
  const Tog = ({ id }) => (
    <button onClick={() => toggle(id)} style={{ width: 42, height: 22, borderRadius: 11, border: "none", background: toggles[id] ? C.green : C.borderSolid, position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
      <span style={{ position: "absolute", top: 2, left: toggles[id] ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }} />
    </button>
  );
  const Row = ({ id, label, desc, last }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: last ? "none" : `1px solid ${C.border}` }}>
      <div><div style={{ fontSize: 13.5, fontWeight: 500, color: C.text, fontFamily: FJ }}>{label}</div><div style={{ fontSize: 11, color: C.light, fontFamily: FJ, marginTop: 2 }}>{desc}</div></div>
      <Tog id={id} />
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: G + 4 }}>
      <Card style={{ padding: 8 }}>
        {["プロフィール", "通知設定", "為替・通貨", "テンプレート", "チーム管理", "API連携", "請求・プラン"].map((l, i) => (
          <div key={i} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13, fontFamily: FJ, fontWeight: i === 1 ? 600 : 400, color: i === 1 ? "#fff" : C.sub, background: i === 1 ? C.black : "transparent", cursor: "pointer", marginBottom: 1 }}>{l}</div>
        ))}
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: G }}>
        <Card style={{ padding: "22px 26px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: FJ }}>通知設定</div>
          <div style={{ fontSize: 11, color: C.light, fontFamily: FJ, marginBottom: 14, marginTop: 2 }}>案件の進捗やメッセージの通知方法を設定</div>
          <Row id="a" label="メール通知" desc="見積回答・納品完了などをメールで受信" />
          <Row id="b" label="Slack通知" desc="チームのSlackチャンネルに通知を送信" />
          <Row id="c" label="WeChat通知" desc="工場からのメッセージをWeChatに転送" last />
        </Card>
        <Card style={{ padding: "22px 26px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: FJ }}>自動化</div>
          <div style={{ fontSize: 11, color: C.light, fontFamily: FJ, marginBottom: 14, marginTop: 2 }}>業務の自動化設定</div>
          <Row id="d" label="自動見積生成" desc="過去の取引データから自動で概算見積を生成" />
          <Row id="e" label="自動為替換算" desc="リアルタイムのUSD/JPYレートで自動換算" last />
        </Card>
        <Card style={{ padding: "22px 26px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: FJ }}>為替設定</div>
          <div style={{ fontSize: 11, color: C.light, fontFamily: FJ, marginBottom: 14, marginTop: 2 }}>見積書作成時の通貨換算設定</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[{ l: "基準通貨", v: "JPY (日本円)" }, { l: "仕入通貨", v: "USD (米ドル)" }, { l: "マージン率", v: "30%" }, { l: "為替バッファ", v: "+3%" }].map((item, i) => (
              <div key={i} style={{ padding: "12px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg }}>
                <div style={{ fontSize: 10, color: C.light, fontFamily: FJ, marginBottom: 3 }}>{item.l}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: i >= 2 ? FD : FJ, ...TN }}>{item.v}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── App Shell ──────────────────────────────────────────────
const TABS = ["Overview", "Analytics", "Companies", "Documents", "Calculator"];

export default function BAOFlowDashboard() {
  const [activeTab, setActiveTab] = useState("Overview");
  const content = { Overview: <OverviewTab />, Analytics: <OrdersTab />, Companies: <SettingsTab /> };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FB, color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=Zen+Kaku+Gothic+New:wght@300;400;500;700;900&display=swap" rel="stylesheet"/>

      {/* ─── Header ─── */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 26px", height: 52, background: C.card,
        borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="16" stroke={C.black} strokeWidth="1.5" fill="none"/>
            <ellipse cx="14" cy="14" rx="5" ry="8" fill={C.green} opacity="0.25" transform="rotate(-15 14 14)"/>
            <path d="M13 18c0-5 3-10 7-10s5 4 5 8-2 7-5 7-7-1-7-5z" fill={C.black}/>
            <circle cx="17" cy="15" r="2" fill={C.green}/>
          </svg>
          <nav style={{ display: "flex", gap: 4 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                border: "none", borderRadius: 20, padding: "7px 18px",
                fontSize: 13, fontWeight: activeTab === t ? 600 : 400,
                fontFamily: activeTab === t ? FD : FJ,
                background: activeTab === t ? C.black : "transparent",
                color: activeTab === t ? "#fff" : C.sub,
                cursor: "pointer", transition: "all 0.15s",
              }}>{t}</button>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, borderRadius: 12, padding: "7px 14px", minWidth: 200 }}>
            {I("M21 21l-4.35-4.35M11 3a8 8 0 100 16 8 8 0 000-16")}
            <span style={{ fontSize: 12, color: C.light, fontFamily: FJ }}>Type Client Name or ID</span>
          </div>
          {[
            "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
            "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z",
          ].map((d, i) => (
            <div key={i} style={{ width: 34, height: 34, borderRadius: 10, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.mid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d}/>{i===1&&<circle cx="12" cy="12" r="3" fill="none" stroke={C.mid} strokeWidth="1.8"/>}</svg>
            </div>
          ))}
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.black, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: FD, cursor: "pointer", ...TN }}>TK</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FD, lineHeight: 1.2 }}>Takeshi K.</div>
            <div style={{ fontSize: 10, color: C.light, fontFamily: FJ }}>Manager</div>
          </div>
        </div>
      </header>

      {/* ─── Sub-header ─── */}
      <div style={{ padding: "18px 26px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.light, fontFamily: FD, marginBottom: 2 }}>Data Based on All Clients</div>
            <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, letterSpacing: "-0.02em", fontFamily: FD, lineHeight: 1.05 }}>
              {activeTab === "Overview" ? "Overview Panel" : activeTab === "Analytics" ? "Orders" : activeTab === "Companies" ? "Settings" : activeTab}
              <span style={{ display: "inline-block", width: 80, height: 2, background: C.borderSolid, marginLeft: 12, verticalAlign: "middle" }} />
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.borderSolid}`, borderRadius: 10, padding: "7px 14px", background: C.card }}>
              {I("M3 4h18v18H3zM16 2v4M8 2v4M3 10h18", 13)}
              <span style={{ fontSize: 12, fontFamily: FD, color: C.mid, ...TN }}>01.12.2023</span>
            </div>
            <div style={{ border: `1px solid ${C.borderSolid}`, borderRadius: 10, padding: "7px 14px", background: C.card }}>
              <span style={{ fontSize: 12, fontFamily: FD, color: C.mid, ...TN }}>01.12.2024</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${C.borderSolid}`, borderRadius: 10, padding: "7px 14px", background: C.card }}>
              <span style={{ fontSize: 12, fontFamily: FJ, color: C.mid }}>All Partner</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div style={{ padding: "0 26px 40px" }}>
        {content[activeTab] || <OverviewTab />}
      </div>
    </div>
  );
}
