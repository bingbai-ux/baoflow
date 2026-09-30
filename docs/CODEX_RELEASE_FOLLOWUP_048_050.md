# 048〜050 ローカル追加修正と公開条件

2026-09-30。対象は `codex/workflow-ux-repair`。本番DB・履歴・業務データ・Storage・メール・GitHub・deploymentは変更していない。先の[認証済みread-only審査](CODEX_RELEASE_REVIEW_038_047.md)の集計はその取得時点の証拠であり、以下の新SQLは本番未適用。

## ローカルで完成した追加範囲

- RFQ作成に未登録工場名/任意メールを追加。保存済み回答を案件のRFQステップで確認し、工場基本情報の登録画面へ進み、**回答元の登録工場を営業/管理者が明示選択**して取り込む。自動照合はしない。
- 048は提出済み回答・招待・RFQ・所有案件・商品/variant・全依頼仕様・数値・依頼時数量を再検証。依頼時snapshotの数量で工場回答見積を作り、回答原文・見積ID・選択工場・実行者を同一transactionで保存する。同じ回答/工場の再試行は同じ見積IDを返し、異なる工場への再取込を拒否。既に提出された回答はリンク期限が過ぎても取込可能。取消済み回答・archive案件は拒否する。フォームを再開したり工場に再送させたりしない。
- 049は送信前に永久の要求予約をcommitし、その予約を取得できた呼出しだけがproviderへ1回POSTする。成功時にprovider message IDと送信済み印を原子的に保存。不明結果・provider拒否・DB保存失敗・プロセス停止後の予約を自動解除しない。24時間のprovider key期限を過ぎても再POSTしない。これは重複防止を優先する設計で、メール到達の保証ではない。
- 送信予約がある場合はサービス履歴の確認/リンク共有へ案内。API key・送信元RFQ_MAIL_FROM・公開URL・宛先の不足は予約前に検出する。開発用onboarding送信元へのfallbackをやめ、明示設定を必須にした。送信失敗後のアドレス修正や無条件な再送、永久予約の削除UIは用意しない。管理者がprovider履歴で受理IDを確定できた場合だけ、同じ実行者の `finish_rfq_email(...,'accepted',確認済みID)` で結果確定できる。別実行者や確認不能の状態はリンク共有を用いる。履歴保存失敗後に「成功していない」と推測して予約を消してはならない。
- 049適用時、既存の `invitation_sent_at IS NULL` 招待があれば停止する。昔の送信成功＋DB保存失敗と未送信を区別できないため。先の本番読取では全RFQ/招待0件だったが、切替直前に再確認が必要。新たに存在する場合はprovider履歴を照合し、不明を永久保留として登録する**別途審査済みのbackfill案**を用意する。招待/回答を削除してこのgateを通過させない。
- 050はbucket一致だけの旧INSERT/DELETE policyを置換し、営業/管理者かつ存在する案件UUIDのpathだけを許可する。uploadは非archive案件、deleteはarchive済みを含む既存案件path。UPDATE/upsertは許可しない。未知のStorage write policyがあればOR許可の残存を避けるため適用前に停止する。public読取、bucket設定、既存fileは変更しない。
- 050はpublicの既存通常/partitioned表のTRUNCATEをPUBLIC/anon/authenticatedから撤回。migration実行者のpublic default privilegesも撤回し、同じcreatorの将来表にも適用する。service_roleの運用権限を拡大/変更しない。他creator/default ACL・role継承による権限は適用前後の審査が必要。
- 旧採用見積の読取/価格/原文/元帳票を維持。商品仕様がない案件には警告を出し、新しい工場発注ボタンを無効にする。旧帳票のsnapshotがない場合の参考表示警告を維持し、新しい帳票は別番号・新snapshotで発行する。原本を当時の内容として現在値から捏造しない。

## 手動対応の最小一覧（個人情報を含まない）

本番read-only集計では6非archive案件/6採用見積。全6件はvariantなし・旧spec_idなし・商品階層なし、既存工場あり、製作以降0件。取得したのは集計だけで、個々の案件名・ID・資料・連絡先は取得していない。下の番号は匿名の作業枠であり、実recordとの対応を推測しない。

| 作業枠 | 仕様/商品 | 元見積・工場 | 必要な手動対応 |
|---|---|---|---|
| 1 | なし | 保持 | 元資料で仕様を確定し、将来発注用の新仕様/新見積を登録 |
| 2 | なし | 保持 | 同上 |
| 3 | なし | 保持 | 同上 |
| 4 | なし | 保持 | 同上 |
| 5 | なし | 保持 | 同上 |
| 6 | なし | 保持 | 同上 |

営業の既存管理画面で警告のある案件を確認する。再見積/再採用が既存契約額や承認に影響する場合は、元資料と顧客承認に基づく個別の業務判断が必要。今回、既存6件への商品/仕様追加、元見積のfactory/variant/status/価格変更は一切していない。

[scripts/preflight-legacy-manual.sql](../scripts/preflight-legacy-manual.sql) はREAD ONLY、10秒timeout、rollback、最大100行。完全な可視性を持つ認可actorだけで使い、一時case番号/状態/件数/欠損flagsのみ返す。個人名・顧客名・record ID・価格・token・payloadを返さない。案件照合用の私的識別子をレポートへexportしない。既存RLSで一部だけ見えるactorの結果を完全一覧とは扱わない。

## 合成fixtureでの検証とデータ複製

実データのコピーは不要。PGliteのメモリDBに、リポジトリの実SQL001/002/003/010〜037を読み込み（顧客seed011/015は除外）、6旧案件/採用見積・snapshotなし旧帳票1・未完了入出庫各1だけを合成する。038〜050を順に適用し、旧列の値を全比較して不変を確認。新しい帳票番号とsnapshot、仕様不足の発注拒否、043→045→048の未登録回答取込を実関数で検証する。SQL一覧の確認からも、旧データを新仕様へ自動移行するDMLはない。

別のfocused SQL試験で、部分/重複/案件違い/数値不正の回答拒否、最終ledger失敗の全rollback、取込replay、30日後のメール予約、保存失敗後の予約維持、実行者違い、受理receipt不変、匿名/顧客/工場/物流のRPC/台帳書込/TRUNCATE拒否、Storage直操作拒否と正当staff操作、未知policy停止と未commit変更のrollbackを検証。メール/Storage actionは外部依存を完全に差替え、実サービスへ接続していない。

ブラウザはlocalhost fixtureの合成データのみ。未登録依頼→外部回答→明示取込→再読込、既存RFQのretry/リンク共有、失われた応答後のRFQ復帰、旧見積閲覧/発注制限/旧帳票参考表示/新発行をfocused確認する。フォーム秘密値の永続保存を追加していない。

PGliteは実Supabase Auth/Storage/providerや本番の全role/default ACL/拡張/migration履歴を再現しない。既知の実Supabase代表経路や全面suiteを再実行する代わりに、今回の差分を検証した。Dockerは起動していない。メモリDBは各試験のfinallyでclose、fixtureサーバーはPlaywright終了時に停止。実顧客dataの保管先・保持期間・削除対象は発生しない。backupの復元可能性は合成試験では証明できない。

## 次の承認と安全な適用順序

1. **既存の隔離ステージングへの038〜050適用と実ロール/Storage連携試験**：対象DB/既存資源を明示し、まず合成fixtureのみ投入。既存policy/所有者/default ACL/履歴とSQL hashを照合し、変更対象は新2ledger・新3RPC・既存Storage2write policy・public TRUNCATE/default ACL。外部通知停止、Storageは専用合成file/path/actorだけ。private化や本番file変更・実顧客dataコピーを含めない。schema差やrollback失敗時は停止する。実データが必要になった場合はコピー対象/理由/マスク/保管・削除を先に別提示する。
2. **専用テスト宛先へのメール1通と設定存在確認**：RESEND_API_KEYの値を出さず、送信元domain/設定名・配置を管理者が確認する。受理ID/予約/送信印/応答消失を照合。実顧客送信・本番再送・新課金/アクセス作成は含めない。現在env確認手段と実送信は未検証。
3. **本番backup・migration・公開**：上記合格後だけ、対象SQL/hash/履歴対応と候補commit、書込停止時間、暗号化backup/復元手順を具体化して別承認。001/010/031等を再適用せず、038→047→048→049→050の順を明示。本番ではseedを使わない。Storage実体はDB backupだけで保全されない。切替直前にRFQ0件/旧仕様6件/料金重複/在庫整合性/未知write policy/全creator grantを再確認。
4. 障害時は対象writerを停止し、commit済み段階を特定して限定rollforwardを優先。新要求/取込/送信receipt・帳票番号・発注snapshot・在庫台帳を保持。048/049は機能とRPC実行を停止しても保存ledgerを削除しない。050のwrite制限を広い旧policy/grantへ戻すことを復旧策にしない。適用transaction内の失敗は全rollbackできることを試験済みだが、commit後の全DB restoreは適用後取引を失う別承認事項。

6件の本番修正・private bucket/URL移行・費用区分/契約額の変更・push/PR/deployは今回のローカル修正とは別承認。public fileの機密区分と料金の原価込み/別途請求方針は未決。公開保留を継続する。

## 最終検証

- 対象44件PASS：mail/Storage action22、取込/メール予約/権限/rollback SQL8、全source migration合成旧データ1、RFQ原子作成4・回答5、帳票原子発行4。重い試験は `--test-concurrency=1` で直列。最終mail/権限30件PASS、残りの関連14件PASS。
- 対象ブラウザ4ケースPASS（登録RFQ retry、未登録回答取込、旧見積/帳票互換、RFQ応答消失後復帰）。最後の入力検証追加後は該当取込ケースだけ再実行しPASS。無効メールではRFQを作らず、入力訂正後に保存可能。
- 変更した案件・帳票ページのHTTP 200もブラウザで確認。F&C色/形状、明示label、button disabled中の重複防止、effect cleanupを確認。工場選択肢は必要な場合だけ同じ認可済みserver actionで取得し、UIへはID/名前だけ返す。
- lint（警告なし）/typecheck/build/差分チェックPASS。buildのBrowserslistデータ更新案内は既存の依存メタデータで、今回依存更新はしていない。
- 全suite・Docker・実Supabase代表業務を重複実行していない。localhost3100/55440の検証サーバー停止を確認。

## 新migration候補のSHA-256

| SQL | SHA-256 |
|---|---|

| 20260930094842_048_pending_rfq_import.sql | 73f1fbdfbb4f58b573336806eed80d009e28bb92c41887c0f576ef5578580e79 |
| 20260930094843_049_rfq_email_receipts.sql | 4ba4e3df9dffe5eb2dfa2ccfd0cd517fbf555710bf6d4624addd150c3ad5e6ad |
| 20260930094844_050_storage_and_table_privileges.sql | 0df685e76d72fc665d23084bd38daef55092a6bc00d93773a54a4d7f2110252a |
