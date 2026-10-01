# 第2段RFQ：実装前設計

2026-10-01。設計時の照合基点 c3e0a026d0094feffcba9d7c615a11725a5c262c。第1段はその後本番公開済み（main f5ae386）。以下は設計時の比較を保持する。第2段はローカル実装済み・受入検証中、本番未適用。実装差分と公開ゲートは CODEX_RFQ_STAGE2_RELEASE_GATE.md。

実装ではexpected_preview JSONをロック後の正規化JSONと比較し、メールはSHA256で確認内容を照合する。内部メモ/other_notesを自動共有しない。親RFQ参照・改訂番号は追加せず、既存RFQ番号別の凍結履歴を表示する。これらを設計案の全項目完了とは扱わない。

## 現在の契約と不足

|実装|確認した挙動|第2段との差|
|---|---|---|
|rfq-create-modal.tsx|商品と工場の選択、期限/共通文、作成後にリンクコピーと個別メール|仕様/数量の選択なし、作成前相手別previewなし。RFQ作成と送信は別処理|
|rfq.ts createRfq / 043 create_rfq_atomic|営業/管理者、同一案件所属、基本情報完了工場、UUID再試行。全仕様と全正数量をsnapshot化し全工場に同じ内容。作成で既存回答token発行|product_idsだけでは部分仕様・数量を渡せない。保存時にDBを読み直すためpreviewと内容一致する保証なし|
|045 ext_rfq_context|tokenの期限/状態を検証しrequested_linesを返す。案件名/顧客/売値は出さない|印刷方法/加工/色/備考は043snapshotに入らない。message/期限はrfq_requestsから読むため版凍結を別途保証する必要|
|045 ext_submit_rfq|snapshotに含む全仕様の回答を検証。仕様ごと1単価を各依頼数量へ展開|数量別単価の回答には現契約を流用できない。未登録回答の048取込も同時に合わせる必要|
|049 claim/finish_rfq_email|送信前に永続予約、結果不明でも再POST禁止。acceptedは事業者受付、到達保証ではない|相手別メールpreviewや宛先固定なし。送信直前に工場masterの宛先を読む。UIのsentIdsだけではreload時の履歴表現が不足|

旧snapshot欠損のRFQは045が回答を拒否する。根拠なしの補完をしない。旧見積6件の仕様紐付けは別問題として保持する。

## 画面と操作

案件詳細RFQ工程を全幅の作業面とし、商品カード→仕様→数量候補をチェック選択する。商品番号/短縮ID/仕様名/WHD/素材を表示。同案件内のみ。工場は検索と選択を独立させ、基本情報不足/宛先不足を具体的な解除手順で示す。宛先不足でもリンク共有用RFQは作成可能、メール確定だけ不可。

共通選択を全工場へ配ることを標準にし、相手タブでは送付先と同じ対象行を確認する。工場別の異なる対象割当は第2段の必須には混ぜない。複数案件は案件別RFQに分け、商品を移動しない。

操作は「依頼内容を確認」→相手別preview→「この内容で回答リンクを作成」。previewには仕様・数量・期限・文面、宛先、相手へ見せない情報を明示。閲覧/取消ではDB書込・採番・token・メールなし。作成後は相手別に「メール内容を確認」→「○○工場へ送信を確定」、またはリンクコピー。まとめて確定する場合も相手別結果を保持し、未送信/受付済/不明/拒否を区別。全件成功の誤toastを出さない。

「回答リンク作成済」≠「メール受付済」≠「到達」≠「回答済」。受付済を到達済と表示しない。後から内容を変える場合は新RFQとし、旧依頼/回答を残す。旧回答リンクの停止は別の明示操作であり、新版作成だけで勝手に失効させない。

## API・データの変更案

1. 読取preview actionを営業/管理者限定で追加。DBから商品/仕様/数量/工場を取得し、選択値を検証して正規化JSONとSHA256を返す。秘密tokenは作らない。保存しないpreviewは版番号を採番しない。
2. 既存の create_rfq_atomic と旧呼出を残し、新版の作成RPCを追加する案。入力は request_id/deal_id と requested_lines[{product_id,variant_id,quantities}]、factory_ids、pending_factories、deadline/message、expected_preview_hash。クライアント提供の寸法/素材/名前は信用せずDBから再構成。同一transactionでpreviewのhashと比較、不一致なら保存0件で確認解除。仕様/数量/工場を安定順でlockして再読取する。ロック後も整合しない競合は中止し、最新previewを再確認させる。
3. requested_linesには必要な仕様だけを明示allowlistで凍結する。追加候補：color_description/pantone_colors/processing/print_method/other_notes。備考は顧客の個人情報や社内情報を含み得るため「工場共有備考」を別に選択して確認する。内部メモを自動送付しない。
4. external_forms.contextに schema_version=2 とRFQ共通文/期限/対象行のsnapshotを保存。既存snapshotはversion1として現挙動を維持。外部context/submit/未登録取込は両版を分岐。v2は選んだ数量のみを受け付ける。
5. 数量別回答はv2でproduct/variant/quantityを一意キーとする。単価/MOQ等の検証を行い、未依頼数量・重複・欠損を拒否。旧v1の一単価展開を変更しない。数量ごとの採用候補と工場回答snapshotを残す。数量別回答が実装されるまで「数量別見積対応済み」としない。
6. RFQは新作成ごとに既存rfq_numberを使い、親RFQ参照と改訂番号を追加する案。参照の同案件検証必須。旧行を上書きせず、旧依頼や回答を閲覧可能にする。旧データは一括backfillしない。
7. メールpreviewはfrom/to/subject/body/linkの確定内容を取得しhash化。送信時は再構成してhash一致確認、宛先変更なら再確認へ戻す。確定時に永続receiptへ送付先/件名/文面versionとsnapshotを保存する案。token URLを含むsnapshotは営業/管理者のみ読取、ログ/分析/画像へ出さない。予約から外部POSTまでの間にmasterを書換えても、保存した確定宛先へだけ送る。
8. 049のat-most-onceを保持。成功保存失敗/タイムアウト/24時間経過/再読込は新POSTの理由にしない。unknown/rejectedの解除・再送仕組みは今回追加しない。ユーザー指定の再送が必要なら新依頼との関連と重複リスクを別設計する。

UI側でも対象・宛先・期限・文面・工場共有備考の変更で確認を即解除し、作成/送信CTAを無効化する。サーバhash一致確認が最終保証。永続request_idは確定時に既存recovery経路を利用し、plain form入力をlocalStorageへ保存しない。

## ロール・権限差分

|役割|読取/操作|既存との差と承認境界|
|---|---|---|
|営業/管理者|同案件RFQpreview/作成、相手別メールpreview/確定、履歴、未登録回答の明示取込|業務操作のロールは既存承認範囲。新RPC EXECUTEや追加snapshot列のgrant/RLSはmigration審査対象。現時点では未作成・未適用|
|工場|自社招待または有効な既存外部回答tokenで指定行の仕様/数量を読取・回答|他工場名/宛先/回答/顧客/売価/社内備考を開示しない。v2外部RPC追加は既存anon権限の無条件拡大ではなくtoken検証を維持し、個別審査|
|物流/顧客|RFQ作成・送信・工場比較は不可|新読取権限を与えない。既存役割の処理を変えない|

必要migrationは互換追加を基本にし、旧RPC削除や既存データ破壊をしない。定義者権限・search_path・PUBLIC/anon EXECUTE・RLS・TRUNCATEを審査する。追加権限の本番適用は親の承認対象を明示してから。外部実メール・新credential・新公開アクセス設定は実行しない。

## 対象テスト計画

- pure契約：選択の順序を変えても同hash、対象/数量/期限/文面/宛先変更はhash変更。未入力・重複・不正数量・異案件・未選択仕様を拒否。
- PGlite/localhost SQL直列：2商品×2仕様×3数量から部分選択、2工場/未登録への同内容保存、preview変更競合rollback0件、request_id retry同結果/入力違い拒否、採番とtoken作成の原子性。v1/v2回答と048pending取込の数量・snapshot一致。旧回答/旧帳票を保持。
- ロール：営業/管理者のみ新action/RPC、物流/顧客拒否、工場AtokenでB招待を読めない、expired/cancelled/submitted拒否。tokenを画像/ログに残さない。
- browser：選択→相手別preview→戻って変更すると確認解除→再確認→作成、preview取消時state書込0、工場未登録/基本情報不足/宛先不足の解除導線、reload復帰、keyboard/mobile、読込/失敗/empty/成功後nextstep。
- local Mailpit等隔離：2工場へ相手別宛先/件名/仕様/数量/期限一致、他工場情報なし。予約/DB失敗/通信不明/長期retryでPOSTが増えない。受付/到達を別検証。実取引先メールなし。
- 必要な変更後だけ対象journey、lint/typecheck/build。全route/重い全suiteや実顧客コピーを設計段階で再実行しない。

## 次の実装単位

まずUIの選択/preview/変更時確認解除を合成fixtureで実装し、保存契約の追加を別差分としてレビューする。旧product_ids RPCだけでは部分選択とpreview一致保証を満たせないため、互換新版RPCを完成するまで該当確定ボタンを実運用可能とは扱わない。第1段公開とは別のSHA・受入証拠を持たせる。
