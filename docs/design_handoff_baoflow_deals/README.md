# Handoff: BAOFlow — 案件管理リデザイン

## Overview

BAOFlow is an internal B2B operations app for a Japanese trading/packaging agency that connects Japanese clients (coffee roasters, food makers, tea brands, cosmetic brands, etc.) with Chinese contract manufacturers. The core artifact is the **Deals (案件) management system** — replacing a giant Excel spreadsheet that the team currently uses to track every quote, order, factory negotiation, payment, and delivery.

This handoff covers the full redesign:

- **5 list-view variations** of the deals table — each with a different density/structure tradeoff
- **Dashboard** — KPIs, pipeline, attention list, top clients, activity stream
- **Master data screen** — clients + factories (split-pane "email UI" layout)
- **Deal detail modal** — 4 tabs (詳細 / 履歴 / 添付 / コミュニケーション)
- **Document generation center** — quotes, invoices, delivery notes, RFQs (multi-deal selection → editable preview → print)
- **Mobile (iPhone) view** — for status checks and quick updates on the go
- **Supporting modals** — new client, status changer, inline cell edit

## About the Design Files

The files in `source_designs/` are **design references created in HTML+React (via Babel inline JSX)**. They are prototypes showing the intended look, layout, and behavior — **not production code to copy directly**.

The task is to **recreate these designs in the target codebase's existing environment** (most likely React + TypeScript with the team's existing component library, design tokens, and data layer). All mock data, calculations, and interactions in the HTML are illustrative — the production implementation should wire them to real APIs, real auth, and real persistence.

Key starting point: open `source_designs/Deals UI Redesign.html` in a browser (no build step needed, just serve the folder) to see all artboards laid out on a pan-and-zoom design canvas.

## Fidelity

**High-fidelity (hifi)**. All colors, typography, spacing, density, copy, status labels, icons, and interaction patterns are intentional and finalized. The developer should aim to recreate the UI pixel-perfectly using the codebase's existing libraries — but **substitute the codebase's existing design tokens** wherever the project already has equivalents (color palette, type scale, spacing units, button styles, etc.).

If the codebase has no existing design system, use the tokens listed in the **Design Tokens** section below verbatim.

---

## Screens / Views

There are **9 top-level artboards** on the design canvas, plus several modal/popover surfaces.

### 1. Dashboard (`dashboard.jsx`)

**Purpose**: Landing screen. Lets the user (sales staff or manager) see overall pipeline health, what needs attention today, and recent activity.

**Layout**: 1320×920 canvas. Top KPI strip → 2-column body (main: pipeline funnel + attention list; right rail: top clients + activity feed).

**Components**:

- **KPI strip** (4 tiles, equal width)
  - 進行中案件数 (active deals)
  - 今月の売上見込 (forecast revenue, JPY)
  - 平均粗利率 (avg margin %)
  - 要対応 (needs-attention count, red badge if > 0)
  - Each tile: large Fraunces serif number, small label above, delta pill below
- **Pipeline funnel**: 7 status columns (見積中 → 納品完了) horizontal bar chart with deal counts. Hovering a column highlights deals at that stage.
- **要対応リスト** (attention list): table with 3 categories — 納期迫り (delivery in ≤14 days), 停滞 (no update in 5+ days), 入金待ち (awaiting payment). Each row clickable → opens deal detail modal.
- **トップクライアント**: top 5 clients by accumulated revenue this fiscal year, with sparkline.
- **直近のアクティビティ**: timeline of recent status changes / new deals / messages, last 10 events.

### 2. Master Data — Clients + Factories (`master-screen.jsx`)

**Purpose**: View and edit the contact/contract details for clients and factories. Used during invoice/RFQ generation (auto-fills addresses, tax IDs, payment terms, Incoterm).

**Layout**: Email-UI-style split pane. Left = list (240px wide), right = detail panel (fills rest).

- **Top tabs**: クライアント (clients) / 工場 (factories) — switches both list and detail content
- **Left list rows**: 60px tall. Top line = name (bold), 2nd line = location/industry, right side = small revenue total or country flag emoji
- **Right detail panel**, scrollable, sectioned:
  - **Clients**: 基本情報 / 請求先 / 売上ロールアップ (cumulative revenue, # deals, avg margin) / 取引履歴 (last 10 deals, mini-table) / 添付ファイル
  - **Factories**: 基本情報 (incl. WeChat ID) / 得意分野 (specialty chips) / 星評価 (3 categories: 品質/納期/価格, 5-star) / 支払条件・Incoterm / 取引履歴

### 3. Document Generation Center — Print/PDF (`print-docs.jsx`)

**Purpose**: Generate Japanese-style A4 portrait business documents for printing or PDF export. Replaces the team's current "open Excel template, copy-paste, save as PDF" workflow.

**Document types**:
- 見積書 (Quotation)
- 請求書 (Invoice) — supports **multi-deal consolidation**: select multiple deals from the same client → produces ONE consolidated invoice with line items
- 納品書 (Delivery Note)
- 見積依頼書 (RFQ to factory) — bilingual JP/中文/English, no prices, asks factory for quote/MOQ/lead time/packaging

**3-step flow**:
1. **Type + deals selection**: deals are grouped by client (for invoices/quotes/delivery notes) or by factory (for RFQs). Checkboxes for multi-select. Selecting multiple deals from one client → one consolidated doc. Selecting from N clients → N separate docs.
2. **Editable preview**: A4 portrait page, white background, narrow margins. **All text/numbers are click-to-edit (contentEditable)**. Hover = yellow highlight (`#fffbeb`). Line-item rows have a × delete button on hover and a "+ 行を追加" link below the table.
3. **Print**: `@media print` rules hide all chrome (toolbar, sidebar, edit highlights). The document fits one A4 page; multi-page docs paginate.

**Design**: Minimal only (no classic/decorative variant). Company name as plain text wordmark in the header (no logo image). Electronic-issue stamp in the bottom-right of each page.

### 4. Mobile (iPhone) View (`mobile-deals.jsx`)

**Purpose**: For sales staff to check status and update notes on the go.

**Layout**: 390×844 (iPhone 14 size), wrapped in `IOSDevice` frame from `ios-frame.jsx`.

- Top: status filter chips (horizontal scroll: 全件 / 見積中 / 製作中 / 入金待ち / etc.) + search icon
- List: card per deal, 80px tall — client name + deal name (bold), status pill, qty + JPY total (Fraunces tabular nums), small dots for urgency/staleness
- Tap card → detail sheet slides up from bottom (modal) showing the same content as the desktop deal detail modal but stacked vertically (no side rail)
- Bottom tab bar: 案件 / マスタ / ダッシュボード / 設定

### 5. Deal List Variations (5 alternatives)

All five variations render the same dataset (`DEALS` in `shared-data.jsx`) but with different layouts. The team can pick one — or ship multiple as toggleable views.

**Common to all**:
- Row height 30px, font-size 11–12px
- `Fraunces` serif tabular-nums for all numerics; `Zen Kaku Gothic New` sans for text
- Hover row → background `#fafaf9`
- Stale rows (no update in 5+ days) get a faint orange tint `#fffaf2`
- Urgent rows (delivery ≤14 days, status before 発送) show an orange dot ●
- Money columns: hover any JPY value → tooltip shows USD and CNY equivalents
- Status column: colored dot + text label. Status palette is fixed (see Design Tokens).

#### v1 — Spreadsheet (`v1-spreadsheet.jsx`)
Excel-faithful. ID and 案件名 columns are sticky-left. All 14 columns scroll horizontally. Cells are click-to-edit inline (`inline-cell.jsx`). Optional client-grouping toggle. Highest density.

#### v2 — Hybrid (List + Detail Form) (`v2-hybrid.jsx`)
Left = ultra-compact list (28px rows, just ID + name + status dot + qty + JPY). Right = full form for the selected deal with all fields. ↑↓ keys move selection. Auto-calc fields (USD, JPY, profit%) update live. Best for "edit-heavy" workflows.

#### v3 — Kanban by Status (`v3-kanban.jsx`)
7 columns, one per status. Within each column, deals are sub-grouped by client. Column header shows count + total JPY. Cards show deal name, client, qty, JPY, factory. Best for "where are we stuck?" overview.

#### v4 — Grouped by Client (Notion DB style) (`v4-grouped.jsx`)
Clients are large foldable section headers showing: count, in-progress count, accumulated revenue, avg margin. Under each, a normal table of that client's deals. Closest to "client-centric reading."

#### v5 — Nested Expandable ⭐ RECOMMENDED (`v5-nested.jsx`)
The team's preferred direction. 3-level nesting:

1. **Client** (foldable) — same rollup as v4
2. **Deal** rows (▶ to expand) — full spreadsheet density
3. **Quantity/price variants** (sub-rows) — same spec, different MOQ tiers (e.g. 500個 / 1000個 / 3000個)

Variants editable inline; "+ バリエーションを追加" creates a new tier; "採用" radio-style picks the active one (marked ●). Combines v1 density + v4 client structure + the team's frequent need to compare quantity tiers within a single deal.

### 6. Deal Detail Modal (`deal-detail-modal.jsx`)

Opens when clicking a deal row in any list view. Width 980px, centered overlay. Also exported as `DealDetailPane` (no overlay, used for split layouts).

**Header**: deal ID + client name + status pill + urgency dot, large editable title (Fraunces 20px), close button.

**Tabs** (4):

#### 詳細 (Details) — main + right side rail
- Main: 仕様 textarea, **数量・価格バリエーション** table (qty / unit USD / total JPY / profit% / 採用 column with green highlight on adopted row), メモ textarea
- Side rail (280px): クライアント, 希望納期, 担当 select, 工場 select, FX rate, 掛け率 (cost ratio), version

#### 履歴 (History)
- **Status progression visual**: 7-circle horizontal stepper at the top (見積中 → 納品完了). Done = filled with check, active = larger ring + glow, pending = dashed outline. Date below each.
- **Filter chips**: すべて / ステータス / 編集 / バリエーション / 添付 / 通信 (with counts)
- **Timeline**, grouped by date (newest first), vertical line + colored dots. Each entry: title, kind tag, time + author, optional body.

#### 添付 (Attachments)
- File category chips: 仕様書/入稿 / 見積 / 写真/サンプル / 契約 / その他 (each with a colored dot + count)
- Drag-drop zone
- **2-column grid of file cards**, grouped by category when "all" selected. Each card: 56×56 thumbnail (file-type-aware: photo grid, doc with lines, sheet grid, AI logo, mail icon, etc.) + name + version chip if v2+ + size · date · uploader + プレビュー / DL / 履歴 links.

#### コミュニケーション (Comms)
- Filter: すべて / クライアント / 工場 / 内部メモ
- Unread count badge in red
- Follow-up reminder banner (yellow) when any messages have follow-up dates set
- Message list: avatar + name + role + channel chip (with emoji: ✉ メール, 💬 WeChat, 📞 電話, 📝 内部メモ, 🤝 打合せ) + timestamp. Unread = yellow background + left border. Reply / 引用 / リマインド設定 / 既読にする links.
- Composer at bottom: channel select, reminder checkbox, textarea, character count, attach button, send button (greyed out when empty).

**Footer**: 見積依頼書を生成 / 請求書を生成 / 削除 (left), 最終更新 / キャンセル / 保存 (right).

### 7. Other surfaces

- **`new-client-modal.jsx`**: 2-step modal — basic info → billing/tax info. Inline validation.
- **`status-changer.jsx`**: Popover anchored to a status pill. Shows the 7-stage path with current state highlighted. Click any stage to jump. Logs to history.
- **`doc-generator-modal.jsx`**: Compact version of the print center, opened from inside the deal detail modal footer (skips the deal-selection step since the deal is already known).
- **`inline-cell.jsx`**: Reusable inline-edit cell (text / number / select / date variants). Click → edit input appears in place; Enter or blur to commit, Esc to cancel.
- **`design-canvas.jsx`**, **`ios-frame.jsx`**: Presentation chrome only — not part of the production app.

---

## Interactions & Behavior

### Inline editing
- **Triggers**: single click on any value with a yellow hover highlight, OR `Enter` on a focused row
- **Commit**: `Enter`, `Tab`, or blur
- **Cancel**: `Esc`
- **Tab navigation**: tabs to the next editable cell in the same row, then wraps to the first cell of the next row
- Auto-calc fields (合計JPY, 粗利%) recompute live as you edit qty/unit_usd/fx/cost_ratio

### Status changes
Changing status from quoting → quote_confirmed automatically:
- Logs an entry in 履歴
- Updates 更新 timestamp
- If moving to `delivered`, prompts "請求書を発行しますか?" with a "はい→印刷センター" shortcut

### Document generation
- Clicking 見積依頼書/請求書/etc. from any deal row or detail modal pre-selects that deal in the print center
- Multi-select: shift-click in the deals table or check multiple boxes in the print center
- Same-client multi-select → consolidated invoice (single doc)
- Different-client multi-select → batch (one doc per client, paginated)

### Animations / Transitions
- Modal open: 150ms ease-out fade + 4px upward translate
- Tab switch: instant (no animation)
- Hover row tint: 80ms ease
- Foldable group expand: 200ms ease-out height + opacity
- Status pill change: 150ms color crossfade
- All transitions respect `prefers-reduced-motion`

### Responsive behavior
- Desktop: ≥1280px — full layout
- Tablet: 768–1279px — side rail in detail modal collapses below main content; some 4-column KPI strips wrap to 2×2
- Mobile: <768px — use the dedicated mobile screens (`mobile-deals.jsx`); do not try to squish the desktop table

---

## State Management

### Top-level state (e.g. Redux/Zustand store)
- `deals: Deal[]` — see schema below
- `clients: Client[]`
- `factories: Factory[]`
- `currentUser: { id, name, role }`
- `fxRate: number` (JPY per USD, default 155, editable global setting)
- `costRatio: number` (default 0.55 = 55% — invoice JPY = qty × unit_usd × fx / cost_ratio)

### Per-screen UI state (local)
- Selected deal id (list views, detail modal)
- Active tab (detail modal, master screen, print center)
- Filter chips state (history tab, comms tab, attachments tab)
- Sort/group toggles (list views)
- Multi-select set (print center deal picker)

### Deal schema (TypeScript-ish)
```ts
type Deal = {
  id: string;              // 'BAO-0231'
  name: string;            // 'ドリップバッグ袋 春版'
  client: string;          // FK -> clients.id
  spec: string;            // free text
  qty: number;
  unit_usd: number;
  total_jpy: number;       // computed: qty * unit_usd * fx / cost_ratio
  profit_pct: number;      // computed
  status: 'quoting' | 'quote_confirmed' | 'paid' | 'data_confirmed'
        | 'in_production' | 'shipped' | 'delivered';
  delivery: string;        // ISO date
  factory: string;         // FK -> factories.name (or '—')
  sales: string;           // staff name
  version: string;         // 'v1', 'v2a', etc.
  updated: string;         // ISO date
  memo: string;
  variants: Array<{        // quantity tiers — see v5
    qty: number;
    unit_usd: number;
    total_jpy: number;
    profit_pct: number;
    version: string;
    note: string;          // 'メイン' | '少量' | '大量' | custom
  }>;
};
```

---

## Design Tokens

### Colors

```
/* Surfaces */
--bg-app:        #f2f2f0;   /* canvas background */
--bg-surface:    #ffffff;   /* cards, modals */
--bg-muted:      #fafaf9;   /* sidebars, side rails */
--bg-row-hover:  #fafaf9;
--bg-row-stale:  #fffaf2;   /* deal not updated in 5+ days */

/* Text */
--text-primary:   #0a0a0a;
--text-secondary: #555555;
--text-tertiary:  #888888;
--text-muted:     #bbbbbb;

/* Borders */
--border-soft:   #f0f0ee;
--border-medium: #e8e8e6;
--border-strong: #d8d8d4;

/* Accents (use sparingly) */
--accent-warm:    #e5a32e;   /* urgent / awaiting payment */
--accent-success: #15803d;   /* delivered, profit ≥35% */
--accent-success-light: #22c55e;  /* status dots */
--accent-danger:  #dc2626;   /* unread, delete */
--accent-info:    #2563eb;   /* client side */
--accent-purple:  #7c3aed;   /* contracts */

/* Status palette (deal status) */
quoting:         #bbbbbb
quote_confirmed: #22c55e
paid:            #e5a32e
data_confirmed:  #0a0a0a
in_production:   #0a0a0a
shipped:         #888888
delivered:       #22c55e
```

### Typography

```
font-family-text:    'Zen Kaku Gothic New', system-ui, sans-serif;
                     weights: 300, 400, 500, 700
font-family-display: 'Fraunces', Georgia, serif;
                     weights: 400, 500, 600, 700
                     usage: ALL numerics (with font-variant-numeric: tabular-nums),
                            section/card titles, large display numbers
```

| Use | Size | Weight | Family |
|---|---|---|---|
| Body / table cells | 12px | 400 | Zen Kaku |
| Tertiary label | 10–11px | 400–500 | Zen Kaku |
| UPPERCASE eyebrow | 10px, letter-spacing 0.06em | 500 | Zen Kaku |
| Card / section title | 14–18px | 600 | Fraunces |
| KPI big number | 28–36px | 600 | Fraunces |
| Modal title | 20px | 600 | Fraunces |
| Numerics in tables | 12px | 400 | Fraunces tabular-nums |

### Spacing

4px base. Common values: 4, 6, 8, 10, 14, 18, 24, 28, 40.

### Border radius

```
--radius-sm: 4px;   /* chips, small badges */
--radius-md: 6px;   /* buttons, inputs */
--radius-lg: 8px;   /* file cards, alerts */
--radius-xl: 14px;  /* panels */
--radius-2xl: 16px; /* modal */
--radius-pill: 9999px;
```

### Shadows

```
--shadow-modal: 0 24px 60px rgba(0,0,0,0.25);
--shadow-card:  0 1px 2px rgba(0,0,0,0.04);
--shadow-pop:   0 8px 20px rgba(0,0,0,0.12);
```

### Number formatting helpers (replicate exactly)

```ts
fmtJPY('¥' + Math.round(n).toLocaleString())              // ¥362,400
fmtUSD('$' + n.toLocaleString(undefined, {min:2, max:2})) // $1,234.00
fmtUSDsmall(n.toFixed(4) + ' USD')                        // 0.0420 USD (for unit prices)
fmtDate(YYYY-MM-DD → 'M/D')                               // 5/12
fmtDateLong(YYYY-MM-DD → 'YYYY年M月D日')                  // 2026年5月12日
```

---

## Assets

The HTML prototype loads only:
- **Google Fonts**: Fraunces, Zen Kaku Gothic New (subset weights as listed above)
- **Icons**: emoji only in the prototype (📄 💴 ✉ 💬 📞 📝 🤝 ⏰ 📋 📎). For production, swap to a proper icon set (Lucide, Phosphor, or the codebase's existing set) — the meanings are obvious from the emoji used.
- **No images** — file thumbnails in the attachments tab are CSS-drawn placeholders (photo grid, doc with lines, sheet grid, AI logo with gradient).
- **No logo image** — company name appears as plain wordmark text in document headers (per client request).

---

## Files

In `source_designs/`:

| File | Purpose |
|---|---|
| `Deals UI Redesign.html` | Entry — canvas with all artboards |
| `design-canvas.jsx` | Pan/zoom presentation chrome (not for production) |
| `shared-data.jsx` | Mock data + helpers (`STATUS`, `CLIENTS`, `FACTORIES_DATA`, `DEALS`, `fmtJPY`, etc.) + `StatusPill` / `StatusDot` / `MoneyHover` / `MiniProgress` / `DealThumb` shared components |
| `dashboard.jsx` | Dashboard screen |
| `master-screen.jsx` | Clients + Factories master screen (split-pane email UI) |
| `print-docs.jsx` | Document generation center (3-step flow + 4 doc templates) |
| `mobile-deals.jsx` | Mobile list + detail |
| `ios-frame.jsx` | iPhone bezel for the mobile artboard |
| `v1-spreadsheet.jsx` … `v5-nested.jsx` | The 5 list-view variations |
| `deal-detail-modal.jsx` | Modal + inline pane variants (4 tabs) |
| `new-client-modal.jsx` | New client creation modal |
| `doc-generator-modal.jsx` | Compact doc generator (from inside deal detail modal) |
| `status-changer.jsx` | Status change popover |
| `inline-cell.jsx` | Reusable inline-edit cell |

---

## Implementation suggestions

1. **Pick one list view first** — recommend v5 (nested expandable) as the production view, with v3 (kanban) as a secondary "view mode" toggle.
2. **Build the data layer first** — Deal/Client/Factory schemas, computed fields (total_jpy, profit_pct), FX/cost_ratio settings.
3. **Build shared atoms** — `StatusPill`, `StatusDot`, `MoneyHover`, `MiniProgress`, formatters. These are used everywhere.
4. **Then the deal list** → **deal detail modal** → **dashboard** → **master** → **print center** → **mobile**.
5. **Print center is its own mini-app** — the contentEditable preview + `@media print` rules deserve their own component file. Consider using `react-to-print` or similar.
6. **Status logic is the spine** — every transition logs to history, every history entry can have an attachment or comm record. Treat history as an append-only event log; derive UI from it.

---

## Out of scope (not designed yet, may be needed)

- Authentication / user management
- Notification system (email digest, push, in-app)
- Bulk actions (bulk status change, bulk export)
- Search across all deals (only filter chips designed)
- Settings / preferences (FX rate adjust, default cost ratio, etc.)
- Audit log / undo
- Real factory RFQ → quote response capture flow (only the outgoing 見積依頼書 is designed)

Discuss with the design team before building these.
