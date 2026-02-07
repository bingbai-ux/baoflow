# BAO Flow コンポーネントカタログ

> v7 ダッシュボードプロトタイプから抽出。shadcn/ui をベースにカスタマイズ。

---

## 1. レイアウト

### Header
- 高さ: 52px、背景: `--card`、下線: `--border`
- 左: ロゴ SVG (32x32) + ナビタブ
- 右: 検索バー + アイコンボタン(2個) + アバター + ユーザー名
- `position: sticky; top: 0; z-index: 100`

### Page Header (Sub-header)
- 左: サブラベル (`--text-light`, 11px) + ページタイトル (Fraunces, 36px, weight 900) + 装飾ライン
- 右: 日付フィルター × 2 + パートナーフィルター
- パディング: `18px 26px 0`

### Content Area
- パディング: `0 26px 40px`
- グリッド gap: `8px`

---

## 2. カード

### Base Card
```
背景:      var(--card)
角丸:      20px
ボーダー:   1px solid var(--border)
影:        なし
パディング: 20px 22px
```

### KPI Card (小)
- CardLabel (アイコン + テキスト) → BigNum → SmallVal/SmallLabel 行 → Barcode チャート
- 最小高さ: 200px
- `display: flex; flex-direction: column; justify-content: space-between`

### Wide Card (工場稼働率、納期遵守率)
- CardLabel → SmallVal 行 → BigNum + SmallVal → CandleChart → 月ラベル

### Pipeline Card
- CardLabel → 水平バー × 6段
- バー高さ 4px, radius 2px
- 最終段: `--green` opacity 0.7, 他: `--black` opacity 0.10〜0.30

### AI Assistant Card
- ユーザーメッセージ (アバター + 名前 + テキスト + ID + 時刻)
- AI メッセージ (グリーンアバター + 名前 + 月別リスト)

### Contact Card
- アバター (32px, bg) + 名前 (JA, bold) + メール (Fraunces) + 矢印アイコン
- 3列グリッド

---

## 3. タイポグラフィコンポーネント

### BigNum
KPIの大数字。カンマで整数と小数を分離し、小数を小さく表示。

```tsx
<BigNum integer="24" decimal="80" unit="M¥" size={44} />
```

- フォント: Fraunces, weight 500
- letter-spacing: -0.03em
- 整数: `size` px
- 小数: `size * 0.5` px (カンマ + 数字)
- 単位: `size * 0.3` px, `--text-sub`, weight 400

### SmallVal
KPIカード内の補助数値。

```tsx
<SmallVal>14.9M</SmallVal>
```

- フォント: Fraunces, 13px, weight 600, tabular-nums
- 色: `--text`

### SmallLabel
KPIカード内のラベル。

```tsx
<SmallLabel>前月</SmallLabel>
```

- フォント: Zen Kaku Gothic New, 11px, weight 400
- 色: `--text-sub`

### CardLabel
カードのヘッダーラベル。アイコン + テキスト。

```tsx
<CardLabel icon={<ClockIcon />}>月間売上</CardLabel>
```

- アイコン: 15px, stroke 1.8, `--text-sub`
- テキスト: Zen Kaku Gothic New, 12.5px, weight 500, `--text-sub`
- gap: 6px

---

## 4. ボタン

### Primary Button
```
背景:    var(--black)
色:      #ffffff
角丸:    8px
パディング: 5px 13px
フォント:  Zen Kaku Gothic New, 12px, weight 500
```

### Secondary Button
```
背景:    var(--card)
色:      var(--text-sub)
ボーダー: 1px solid var(--border-solid)
角丸:    8px
```

### Ghost Button
```
背景:    transparent
色:      var(--text-sub)
ボーダー: none
ホバー:   背景 var(--bg)
```

### Nav Tab (Active)
```
背景:    var(--black)
色:      #ffffff
角丸:    9999px (pill)
パディング: 7px 18px
フォント:  Fraunces, 13px, weight 600
```

### Nav Tab (Inactive)
```
背景:    transparent
色:      var(--text-sub)
フォント:  Zen Kaku Gothic New, 13px, weight 400
ホバー:   色 var(--text-mid)
```

### Filter Chip
```
背景:    var(--card)
ボーダー: 1px solid var(--border-solid)
角丸:    8px
パディング: 5px 13px
フォント:  Zen Kaku Gothic New, 12px, weight 500
Active:  背景 var(--black), 色 #ffffff
```

---

## 5. フォーム

### Input Field
```
背景:    var(--bg)
角丸:    10px
パディング: 7px 14px
フォント:  12px
ボーダー: none
Focus:   border 1px solid var(--border-solid)
```

### Search Bar
```
Input Field ベース
左にサーチアイコン (15px, --text-sub)
プレースホルダー: --text-light
min-width: 200px
```

### Toggle Switch
```
幅:      42px
高さ:    22px
角丸:    11px
Active:  背景 var(--green)
Inactive: 背景 var(--border-solid)
Thumb:   18x18px, #fff, border-radius 50%
         box-shadow: 0 1px 3px rgba(0,0,0,0.12)
遷移:    left 0.2s, background 0.2s
```

### Settings Row
```
display: flex
justify-content: space-between
align-items: center
padding: 13px 0
border-bottom: 1px solid var(--border) (最後の行は none)
左:  ラベル (13.5px, weight 500) + 説明 (11px, --text-light)
右:  Toggle Switch
```

---

## 6. テーブル

### Table Header
```
フォント:  Zen Kaku Gothic New, 11px, weight 500
色:       var(--text-light)
パディング: 10px 14px
下線:     1px solid var(--border)
```

### Table Row
```
パディング: 12px 14px
下線:     1px solid var(--border)
ホバー:   背景 var(--card-hover)
遷移:     background 0.12s
```

### Table Cell — ID
```
フォント: Fraunces, 12px, tabular-nums
色:      var(--text-light)
```

### Table Cell — Name
```
フォント: Fraunces, 13px, weight 600
色:      var(--text)
```

### Table Cell — Japanese Text
```
フォント: Zen Kaku Gothic New, 12px
色:      var(--text-sub)
```

### Table Cell — Amount (右寄せ)
```
フォント:  Fraunces, 13px, weight 600, tabular-nums
色:       var(--text)
text-align: right
```

### Table Cell — Status
```
display:   inline-flex, align-items center, gap 5px
ドット:    5px × 5px, border-radius 50%, statusMap[status].dot
テキスト:   Zen Kaku Gothic New, 12px, var(--text-mid)
```

---

## 7. チャート

### Barcode Bars
超細いバーチャート。KPIカードのミニチャート用。

```
バー幅:    1.5px
ギャップ:   0.8px
デフォルト: var(--black) opacity 0.12
ハイライト: var(--green) opacity 1.0 (末尾2本)
高さ:      22px〜28px
```

### Candlestick Chart
Wide Card用。キャンドルスティック風のチャート。

```
上昇:      var(--green) opacity 0.7
下降:      var(--black) opacity 0.15
ヒゲ:      strokeWidth 0.8, opacity 0.4
バー幅:    自動計算 (幅 / データ数)
高さ:      50px〜60px
```

### Semi-circular Gauge
案件進捗カード用。

```
ストローク幅: 6px
トラック:    var(--border-solid)
進捗:       #ccc
エンドポイント: var(--green) 5px ドット
目盛り:     21本, 5刻みで太く (1.5px vs 0.8px)
目盛り色:   var(--text-mute)
中央数字:   Fraunces, 26px, weight 500, tabular-nums
```

### Pipeline Bar
パイプラインカード用。水平バー。

```
高さ:      4px
角丸:      2px
背景:      var(--bg)
最終段:    var(--green) opacity 0.7
その他:    var(--black) opacity (0.10 + stage_index × 0.04)
数字:      Fraunces, 11px, tabular-nums, --text-mid
```

---

## 8. 特殊コンポーネント

### Insight Banner (Glassmorphism)
唯一のグラデーション許可コンポーネント。

```
背景:     var(--glass-green-gradient)
角丸:     20px
高さ:     185px
overflow: hidden

フローティングカード (3枚):
  背景:   rgba(255,255,255, 0.20〜0.35)
  blur:   6px〜8px
  ボーダー: 1px solid rgba(255,255,255, 0.25〜0.35)
  角丸:   16px
  回転:   ±2〜5deg
  幅:     200px, 高さ: 140px

メインテキスト:
  ラベル:  Fraunces, 13px, weight 600, --green-dark
  本文:   Zen Kaku Gothic New, 26px, weight 700
  数字:   Fraunces内, 28px, weight 600, tabular-nums

カルーセルドット (下部):
  アクティブ:  22×4px, rgba(0,0,0,0.45)
  非アクティブ: 8×4px, rgba(0,0,0,0.12)
```

### Status Dot
```tsx
<StatusDot status="製造中" />
```

ステータスマッピング:
| ステータス | ドット色 |
|-----------|---------|
| 見積中     | --text-light (#bbb) |
| 仕様確定   | --green |
| 入金待ち   | --status-warning (#e5a32e) |
| 製造中     | --black |
| 配送中     | --text-sub (#888) |
| 納品完了   | --green |

### Avatar
```
サイズ:   36px (ヘッダー), 34px (チャット), 32px (コンタクト)
角丸:     50% (円)
背景:     var(--black) (ヘッダー) / var(--bg) (その他)
テキスト:  Fraunces, 12px, weight 600, tabular-nums
```

### Icon Button
```
サイズ:   34px × 34px
角丸:     10px
背景:     var(--bg)
アイコン:  16px, stroke 1.8, var(--text-mid)
ホバー:   border 1px solid var(--border-solid)
```

---

## 9. アイコンルール

- ライブラリ: **Lucide React** (shadcn/ui デフォルト)
- サイズ: 15px (カードラベル), 14px (アクション), 13px (インライン)
- ストローク幅: 1.8
- デフォルト色: `var(--text-sub)`
- アクティブ色: `var(--text-mid)`
- 禁止: Heroicons, Font Awesome, Material Icons 等の別ライブラリ

---

## 10. 設定画面レイアウト

### Settings Sidebar
```
幅:      180px
背景:    var(--card)
角丸:    20px
パディング: 8px

各項目:
  パディング: 8px 14px
  角丸:     10px
  フォント:  Zen Kaku Gothic New, 13px
  Active:   背景 var(--black), 色 #fff, weight 600
  Inactive: 色 var(--text-sub), weight 400
```

### Settings Content
```
グリッド: 180px sidebar + 1fr content, gap 12px
コンテンツ: Card × N (縦積み, gap 8px)
各カード: タイトル (15px, weight 700) + 説明 (11px, --text-light) + Settings Rows
```

### Config Grid (為替設定等)
```
グリッド:  2列, gap 8px
各セル:   padding 12px 16px, 角丸 12px, border var(--border), 背景 var(--bg)
ラベル:   10px, --text-light
値:       14px, weight 600
```
