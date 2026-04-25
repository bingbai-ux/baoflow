# Claude Code 起動時のプロンプト集

このファイルは Claude Code セッション開始時に貼り付けるプロンプトと、CLAUDE.md への追記内容をまとめたもの。

---

## A. 初回プロンプト（Claude Code に最初に貼る）

```
旧 BAO Flow リポを v2.0 Phase 1 に再生する作業を開始する。

【最初に必ず読むファイル】
1. docs/Phase1_実装仕様書.md（最重要、これに従って実装する）
2. docs/Phase1_企画書_v1.1.md（背景理解用）
3. docs/旧BAOFlow_分析結果.md（リポの現状）
4. CLAUDE.md（既存のデザインシステム + Phase 1 ルール）

【作業ルール】
- 仕様書の Sprint 0 から順に実行
- 各 Sprint 完了時に必ず報告（完了タスク、未完了の理由、次の懸念）
- 推測で進めない。不明点は実装前に質問
- _archive/ や _unused/ は読まない・参照しない（Sprint 0 で作成する）
- Phase 1 のスコープ外（権限分岐、翻訳、CRM 連動等）は絶対に実装しない
- master_status は触らない、simple_status のみ使う
- 各 Sprint 完了時に npm run build がエラーなく通ることを確認

【最初のアクション】
Sprint 0 開始前に、リポ全体の現在の状態を以下の観点で確認して報告：
1. ブランチ状態（git status, git branch）
2. package.json の依存関係（更新が必要なものはあるか）
3. .env.local の状態（Supabase 接続が生きているか）
4. npm install と npm run build の現状（エラーがあるか）

確認結果を報告してから、Sprint 0-1（ブランチ作成）に進むこと。
```

---

## B. CLAUDE.md に追記する内容

既存 CLAUDE.md の冒頭または末尾に以下を追加：

```markdown

---

## Phase 1 作業ルール（v2.0）

### 触らないディレクトリ
以下は Phase 1 のスコープ外。読まない・修正しない・参照しない：
- src/app/(main)/_archive/
- src/app/_archive_factory/
- src/app/_archive_portal/
- src/lib/actions/_unused/
- src/components/_unused/

これらは過去の v1.0 のコードで、Phase 2 以降で復活させる可能性があるため
削除せず保管している。Phase 1 では存在しないものとして扱う。

### Phase 1 のスコープ（5 機能のみ）
1. 案件基本情報（案件名・クライアント名・希望納期・担当・メモ）
2. 商品仕様（サイズ・素材・色・加工・印刷）
3. 見積計算（数量別単価・送料・掛け率・税）
4. ステータス管理（7 段階の simple_status）
5. 画像管理（高画質・複数画像）

### Phase 1 のステータス（7 段階）
quoting → quote_confirmed → paid → data_confirmed → in_production → shipped → delivered

旧 master_status（M01-M25）は temporal して触らない。simple_status のみ使用。

### Phase 1 で使うテーブル
- deals（simple_status, visibility, client_name_text, desired_delivery_date, memo を追加）
- deal_specifications（既存、UI で出すカラムを絞る）
- deal_quotes（既存）
- deal_status_history（from_simple_status, to_simple_status を追加）
- profiles（既存）
- documents（画像管理用、流用）

### 詳細
- 全体仕様: docs/Phase1_実装仕様書.md
- 背景: docs/Phase1_企画書_v1.1.md
- 旧リポの状況: docs/旧BAOFlow_分析結果.md
```

---

## C. ファイル配置先

リポ内の以下に配置：

```
baoflow/
├── docs/
│   ├── Phase1_実装仕様書.md         ← 04_Phase1_実装仕様書.md をリネーム
│   ├── Phase1_企画書_v1.1.md        ← 01_BAO_Flow_v2_Phase1_企画書_v1.1.md をリネーム
│   ├── 旧BAOFlow_分析結果.md        ← 03_旧BAOFlow_分析結果.md をそのまま
│   ├── BAOFlow_要件定義書_v3.2.md   ← 既存（Phase 1 では参照しない、Phase 2 用）
│   └── db-schema-actual.md          ← 既存
└── CLAUDE.md                         ← 既存に Phase 1 ルールを追記
```

---

## D. Sprint 進行中によくある質問の想定

Claude Code から以下のような質問が来る可能性あり。事前に回答方針を整理：

### Q1: 「_unused/ に退避した actions が他から import されている」
A: import 元のコードを修正。Phase 1 で使わない関数なら、その呼び出し自体を削除またはコメントアウト。

### Q2: 「deal_specifications の 30+ カラムを全部 UI に出すか？」
A: 出さない。仕様書 Sprint 3-1 の 8 カラムだけ UI 化。他は NULL のまま。

### Q3: 「既存の Smart Quote / AI 機能がエラーを起こす」
A: それらは _unused/ に退避済みのはず。残っていたら退避させる。

### Q4: 「dashboard/ コンポーネントが見つからない」
A: 仕様書 Sprint 4-2 の通り、_unused/ に退避させて新規でシンプルに作る。

### Q5: 「ER 図が必要」
A: 既存 supabase/migrations/010_rebuild_schema.sql を読めば全テーブル定義がある。Phase 1 では新規 migration 018 のみ作成。

### Q6: 「テストはどこまで書くか」
A: Phase 1 では手動動作確認で OK。自動テストは Phase 2 以降で検討。

---

## E. 進捗報告のフォーマット（Claude Code 向け）

各 Sprint 完了時に以下のフォーマットで報告させる：

```
## Sprint X 完了報告

### 完了タスク
- [x] タスク1
- [x] タスク2

### スキップ/未完了
- [ ] タスク3 — 理由: ...

### 動作確認結果
- npm run build: ✅ / ❌
- 動作確認 URL: http://localhost:3000/...
- スクリーンショット: （あれば）

### 気になる点・次 Sprint への懸念
- ...

### Phase 1 全体進捗
N/4 Sprint 完了（約 X%）

### 次のアクション
Sprint X+1 に進む準備ができた。指示をください。
```

---

## F. 困ったら戻る場所

Claude Code で詰まったら、以下を白に伝えて claude.ai のチャットに戻る：

- どの Sprint のどのタスクで詰まったか
- エラーメッセージ全文
- 試したこと
- 自分の仮説

claude.ai の Opus セッションで設計判断を再検討する。
