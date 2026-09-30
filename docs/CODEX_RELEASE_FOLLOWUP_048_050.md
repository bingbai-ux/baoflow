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

PGliteは実Supabase Auth/Storage/providerや本番の全role/default ACL/拡張/migration履歴を再現しない。下記の追加受入では、既承認の専用localhost Supabaseで実サービスを検証した。実顧客dataコピーは不要で、発生していない。

## 追加の実接続受入と本番への確認事項

「既存の隔離ステージング」はクラウド環境を指すものではなかった。今回使用した環境は `local-supabase` / project `baoflow-codex-20260930`、API `http://127.0.0.1:55321`、DB `127.0.0.1:55322`、Mailpit `http://127.0.0.1:55324`。全公開portはloopbackだけ、メールrelayなし。既承認内で起動し、001〜050を顧客seed抜きで適用した。

- `verify-local-release-integrations.mjs` PASS：実Authで営業/管理者/顧客/工場/物流とanon、実PostgRESTの未登録回答→明示取込/replay/同時メールclaim、実Storageの正当upload/public読取/delete・不正role/path/update拒否。実アプリactionのデザインupload/deleteとthumbnail upload/clearも確認。
- メールはアプリのprovider POSTだけをlocalhost Mailpit APIへ差し替え、合成 `sender@example.test` → `factory@example.test` のRFQ本文を3通捕捉。正常受理・receipt保存失敗・受理応答消失を再現し、30日後retryでもPOST追加なし。外部Resend、DNS、実配信到達は検証していない。外部メール送信は行っておらず、ローカル受入に実外部1通は不要。
- `verify-local-backup-restore.mjs` PASS：合成ローカルDBのcustom pg_dumpを同じ専用containerの一時DBへstream復元。件数・履歴・RLS・関数・grant一致、一時DB削除、backupファイルなし。既存ローカルowner `supabase_admin` でrestoreし、新権限は作成していない。これは本番backupの存在/復元可否の証明ではない。
- 両creator `postgres` / `supabase_admin` のdefault TRUNCATE撤回案をローカルtransactionで検証し、両owner作成の将来表をanon/authenticatedがTRUNCATE不可。全rollback・probe表消失を確認。050単体は実行者のdefault ACLだけを変更するため、この追加案は別の確認対象。

本番再読取：[集計/権限metadata](../artifacts/release-security-recheck-20260930.json)。project `uocpewtmhmdfhdvnrljl`、履歴30件/最新037、RFQ0、旧6件、新ledgerなし。既存public通常表53すべてでanon/authenticatedのTRUNCATEが有効。両creatorのdefault table ACLもTRUNCATEを含む。Storage INSERT/DELETEはbucket一致だけの旧policyのまま。データ/権限変更なし。

globalとpublicの全creator default table ACLを追加読取し、外部roleへのTRUNCATEはpublicのpostgres/supabase_adminの4grantだけだった。global grantや第3creatorは取得時点でなし。切替時は同じ範囲を再審査する。

GitHub `bingbai-ux/baoflow` はmainが既定branch、既存接続にpush権限あり。Vercel project `prj_WQKoHTwzGTimDhfRFvhP4yBDbKPx` / team `team_3Mcle4NLyt1bmB1cHRvlOBWA`、production domain `baoflow.vercel.app`、既存production deployment `dpl_8kv6JeHGQB9kVWtArojx8QAmxHpk` READYを再確認。今回の候補はまだpush/merge/deployしていない。

公開/push/必要merge/deploy/通常schema migrationはユーザー承認済み。次の**権限変更だけは親から個別確認**する。本番backupの復元点/方法も確定させる。

| 対象 | 現状→候補 | 影響/限界 |
|---|---|---|
| Storage objects既存2write policy（050） | authenticated+bucketだけ→営業/管理者+存在する案件UUID path。uploadは非archive案件、deleteは既存案件 | 顧客/工場/物流による直接upload/deleteを拒否。public読取・既存file・bucket設定は維持。旧pathでの直接削除は不可 |
| public既存53表とmigration新7表（050） | PUBLIC/anon/authenticatedのTRUNCATE撤回 | 全表消去を拒否。service_roleや通常CRUDはこの撤回で変更しない |
| postgres / supabase_admin のpublic default table ACL | 将来表の同3grantee TRUNCATE撤回 | 050は実行者だけ。[両owner追加案](../scripts/review-default-truncate-privileges.sql)は常にrollback。既存の権限あるoperator実行が必要で、postgresのmembership付与等で迂回しない |
| 038/041〜049のRLS/grant/RPC | 既存出荷明細client INSERTを所有pending requestへ制限、inventory_transactions authenticated UPDATE/DELETE撤回。新7表RLS・所有者/staff読取、発注factory自社読取、発注UPDATE/DELETE撤回。token RFQ context/submit、staff/所有者guard付き原子RPC | 各SQLで定義する認可範囲。新台帳のdirect外部書込を拒否（wizardは既存設計のowner/staff CRUD policy）。匿名RFQは有効tokenが必要。新role/access/credentialは作らない |

本番backup/PITRの利用可能な復元点とprovider内復元手順は未確認。認証済みMCPのproject metadataにはbackup情報がない。provider管理の既存backupを優先し、秘密を第三者へexportしない。Storage実体はDB backup対象外なので既存objectを保持し、新旧app双方から必要なfileを読み取れることを確認する。ローカル機密backup先/暗号鍵/保管期間は承認対象が未特定で、勝手にファイルを作らない。

## 安全な適用順序

1. 上表の権限変更を個別確認し、既存provider backupの復元点と復元operator/方法を確認。RFQ送信元domain、RESEND_API_KEY・RFQ_MAIL_FROM・NEXT_PUBLIC_APP_URLの設定存在だけを確認し値をログへ出さない。設定不足なら送信は予約前に拒否しリンク共有へ案内する。
2. 対象writerを停止した切替時間にRFQ0件/旧仕様6件/料金重複/在庫整合性/未知write policy/全creator grant/履歴とSQL hashを再確認。001/010/031等を再適用せず、038〜047→048→049→050を順次transaction適用し履歴を照合。seedなし。両owner ACL案は権限ある既存operatorが承認された範囲で実行する。途中失敗は後続を止める。
3. tested app commit `8b63e1dde0e8089b60979c6c19901128fb5e9a79` と最終候補のsrc/依存差分ゼロを確認してpush/必要merge/deploy。build/deploymentの正本SHA一致とREADY、production readonly主要画面/認可/snapshot/Storage読取を確認。外部メールをsmokeとして送らない。
4. 障害時は対象writerを停止し、commit済み段階を特定して限定rollforwardを優先。新要求/取込/送信receipt・帳票番号・発注snapshot・在庫台帳を保持。048/049は機能とRPC実行を停止しても保存ledgerを削除しない。050のwrite制限を広い旧policy/grantへ戻すことを復旧策にしない。適用transaction内の失敗は全rollbackできることを試験済みだが、commit後の全DB restoreは適用後取引を失う別承認事項。

6件の推測紐付け・private bucket/URL移行・費用区分/契約額の変更・外部メールは実行しない。public fileの機密区分と料金の原価込み/別途請求方針は未決。公開承認を取り消したものではなく、上記の個別権限確認/backup gateの完了待ち。

## 最終検証

- 対象44件PASS：mail/Storage action22、取込/メール予約/権限/rollback SQL8、全source migration合成旧データ1、RFQ原子作成4・回答5、帳票原子発行4。重い試験は `--test-concurrency=1` で直列。最終mail/権限30件PASS、残りの関連14件PASS。
- 対象ブラウザ4ケースPASS（登録RFQ retry、未登録回答取込、旧見積/帳票互換、RFQ応答消失後復帰）。最後の入力検証追加後は該当取込ケースだけ再実行しPASS。無効メールではRFQを作らず、入力訂正後に保存可能。
- 変更した案件・帳票ページのHTTP 200もブラウザで確認。F&C色/形状、明示label、button disabled中の重複防止、effect cleanupを確認。工場選択肢は必要な場合だけ同じ認可済みserver actionで取得し、UIへはID/名前だけ返す。
- lint（警告なし）/typecheck/build/差分チェックPASS。buildのBrowserslistデータ更新案内は既存の依存メタデータで、今回依存更新はしていない。
- 全suite・実Supabase代表業務の重複実行なし。今回だけ専用Dockerで追加範囲の実接続受入を直列実施。localhost3100/55440の旧検証サーバー停止を確認。
- 最終lint/typecheck再PASS、追加2検証scriptのnode構文確認PASS、tested app SHAからsrc/package/package-lock差分ゼロ。専用Supabaseは `stop --no-backup` で停止し、対象container/volume残存0を確認。初回試験の合成残骸もvolumeごと破棄。外部通知・機密backupファイル・実顧客copyなし。

## 新migration候補のSHA-256

| SQL | SHA-256 |
|---|---|

| 20260930094842_048_pending_rfq_import.sql | 73f1fbdfbb4f58b573336806eed80d009e28bb92c41887c0f576ef5578580e79 |
| 20260930094843_049_rfq_email_receipts.sql | 4ba4e3df9dffe5eb2dfa2ccfd0cd517fbf555710bf6d4624addd150c3ad5e6ad |
| 20260930094844_050_storage_and_table_privileges.sql | 0df685e76d72fc665d23084bd38daef55092a6bc00d93773a54a4d7f2110252a |
