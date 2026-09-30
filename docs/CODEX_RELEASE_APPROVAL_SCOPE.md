# 本番公開に付随する個別確認案

更新：038〜050の権限変更はユーザー承認済み。最新成功backupは2026-09-29 21:56:58 UTC、7世代/Restore確認画面を読み取り確認済み（復元未実行）、PITR未契約。下記未確認記述は初版時点の履歴。最新状態は[追加受入記録](CODEX_ACCEPTANCE_20261001.md)。追加051の営業/admin発行・送信管理は既承認と同じ業務権限で、顧客自社請求SELECT/PDF取得のみアクセス拡大の差分。supabase_admin default ACLは現接続から変更できないため未適用とし、現存53表（すべてpostgres所有）・今回の新表・postgres将来表を保護する代替範囲を提示中。

2026-09-30。公開/push/必要merge/deploy/通常schema migrationは承認済み。本書は個別確認を一度に提示するための候補で、本番変更・backup export・課金はまだ行わない。対象DB `uocpewtmhmdfhdvnrljl` / baoflow-v2、公開app `baoflow.vercel.app`。候補SQLは038〜050と別の両owner default ACL案。既存6件は推測紐付けしない。

「staff」は営業sales/管理者admin。新表は本番にまだ存在せず、現状は「旧個別保存/新RPCなし」からの追加となる。新RPCの実行grantはauthenticatedでも、関数内role/所有者/token検証で業務権限を限定する。invoker RPCは既存RLSも維持する。

| SQL / 対象 | 現状→変更後・誰が何をできる/できない | 既存業務への影響 |
|---|---|---|
| 038 `shipment_request_items` client INSERT policy | 顧客が自分の依頼に明細追加→自分のrequested依頼＋自分の在庫商品だけ追加可。別顧客商品/確認後明細追加を拒否 | 確認後の明細追加は停止。staffの別policyは撤回しない |
| 038 `inventory_transactions` grant、在庫/入出庫RPC | authenticated全員の既存台帳UPDATE/DELETEを撤回。staff/物流は在庫登録・増減・入庫予定・検収・確認済み出荷の原子RPC可。顧客は自社出荷依頼作成可、工場/anonの在庫操作不可 | 台帳の直接訂正/削除は停止し補償増減を追加。既存RLSで見えないrecordはRPCでも操作不可 |
| 039–040 `deals` / `deal_status_history` / `deal_quotes` | 039はstaffだけが状態変更/close/再開と履歴を原子保存、anon実行撤回。040はstaffだけが見積採用を原子的に変更。顧客/工場/物流/anonは不可。既存表policy自体は変更なし | archive案件の状態変更・納品前の完了close・競合状態を拒否。旧6件の採用値は自動変更なし |
| 041 `document_number_counters` / `reserve_document_number` | 新counterはRLS・直接アクセスpolicyなし。staffだけRPC採番、他role不可 | 採番の手動直接変更不可。発行失敗後の欠番を再利用しない |
| 042 `wizard_requests` / `wizard_atomic` | staff本人の要求だけRLSで読取/書込、他人・顧客・工場・物流・anon不可。staffは案件/仕様/数量を原子保存 | 本人staffのdirect要求変更もpolicy上可能な既存候補設計（不可変監査台帳とは扱わない）。旧writerと新writer併用不可 |
| 043 `rfq_creation_requests` / `create_rfq_atomic` | staff作成者本人だけ要求台帳読取、direct書込policyなし。staffだけRFQ＋招待＋外部formを原子作成 | 仕様不備/archive案件を拒否。途中だけ保存される旧経路を新appで置換 |
| 044 `factory_purchase_orders` / 発注RPC | staffは新発注作成/全発注読取、工場は自社発注読取だけ。顧客/物流/anon読取/作成不可。authenticated/anon UPDATE/DELETE撤回 | 発注後の直接修正/削除は不可。旧6件は仕様不足のため新発注不可、読取/帳票再発行は維持 |
| 044 `shipment_requests` status trigger / 入庫・検収RPC | staffは依頼確認/取消、staff/物流は確認後出荷→納品と入庫予定/検収。顧客/工場/anonのstatus変更拒否。物流の確認/取消拒否 | 倉庫が独自に依頼承認/取消する旧運用は停止。状態飛越・過剰入庫・不一致も拒否 |
| 045 `ext_rfq_context` / `ext_submit_rfq` | anon/authenticatedは有効RFQ tokenで依頼snapshot読取/回答提出可。期限切れ/取消/不正仕様/tokenを拒否。未登録回答は保存し自動見積化しない | 不完全/範囲外の旧回答を拒否。未登録は048のstaff明示取込を使用。role全体への表grant拡張なし |
| 046 `documents`番号guard trigger | 同番号の新INSERT/番号変更を拒否。trigger関数をPUBLIC/anon/authenticatedから直接実行不可 | 重複番号で新発行不可。既存帳票/番号を削除・再採番しない |
| 047 `document_issue_requests` / `issue_document_atomic` | staff作成者本人だけ要求台帳読取、direct書込policyなし。staffだけ採番＋帳票snapshot原子発行 | 顧客/工場/物流は発行RPC不可。snapshotなし旧帳票は参考表示、新発行は別番号。既存documents読取policyは維持 |
| 048 `rfq_answer_imports` / import RPC | staffだけ台帳読取と、登録工場を明示指定した提出済み回答取込可。全外部roleの台帳direct書込/取込拒否 | 誤工場への再取込不可。自動照合/未登録のまま採用不可 |
| 049 `rfq_email_receipts` / claim・finish RPC | staffだけ台帳読取・送信予約/同actor結果確定。全外部roleのdirect台帳書込不可 | 不明/DB保存失敗/拒否は永久に再POSTを止める。無条件再送は停止、provider履歴確認/リンク共有。未記録既存招待があればmigration停止 |
| 050 Storage objects INSERT/DELETE 2policy | bucket一致だけの全authenticated→staff＋存在する案件UUID path。uploadは非archive、deleteは既存案件 | 顧客/工場/物流の直接upload/delete、旧形式path操作は停止。UPDATE不可。public読取/既存file/bucket設定は維持 |
| 050 public全53既存表＋新7表、両owner default ACL追加案 | PUBLIC/anon/authenticatedのTRUNCATEを撤回。postgres/supabase_admin作成の将来表も同じ撤回 | 全表消去不可。service_role・通常CRUDはこの撤回で変更なし。両owner変更に既存operator権限が必要、membership付与で迂回しない |

訂正：初版で039を料金source制約と記したのは誤り。実SQLは案件状態/closeと履歴の原子RPC・grantであり、上表に修正した。料金不整合は別のpreflight検査で止める。046と044はgrant以外にtriggerが業務操作を制限するため上表に含めた。Storage/TRUNCATEを他の行で重複承認させない。未知policy/ACL・schema差があれば適用を止める。

## 本番backupの確認結果と最小案

既存MCPにbackup/PITR取得actionなし。既存project metadataから復元点/契約は不明。Dashboardの正規Backups URLを読取で開いたがサインインへ遷移、native Macはロック中。ログイン/新credential作成/料金変更は行っていない。ユーザーの既存ログインで `Database > Backups` と `Point in time` の最新成功backupまたはearliest/latest recovery point、契約を読取確認すれば、provider内の既存backupを優先できる。

公式一般仕様（対象project契約の証明ではない）：Pro日次7日/Team14日/Enterprise最大30日、PITRは有料追加7/14/28日で約$100/$200/$400月＋最低Small compute。新たな有料追加は本案に含めない。restoreは同projectのBackupsで復元点を選び確認実行、停止時間が発生し復元点以降の取引は失う。DB backupにStorage file実体は含まれない。[Supabase公式backup仕様・料金](https://supabase.com/docs/guides/platform/backups)。実際の利用可能点/料金契約は未確認。

既存backupが利用できない場合だけ、以下のローカル案を追加承認対象にする（未作成・未export）。

- 保存先：`/Users/bingbai/Library/Application Support/BAOFlow-Backups/uocpewtmhmdfhdvnrljl/release-20260930/`。同プロジェクト専用だがGit/Document同期領域の外。同期/外部backup対象でないことを事前確認し、外部自動転送を除外できなければ作成しない。
- 既存管理者がAES-256暗号化disk imageを作り、passphraseをユーザーがOS UIで入力/保管。鍵/パスワードはチャット・repo・ログへ出さず、新DB/API credentialを作らない。ディレクトリ0700、image/manifest0600、平文はmounted暗号image内だけ。アクセスは現在のMac所有者/既存管理者に限定。
- scope：public全表data/DDL（個人情報/価格/原文を含む）、enum/index/制約/sequence/trigger/function/owner/grant/RLS、supabase_migrations履歴、復元に必要なauth.users/identities（識別子/メール/password hashを含む）、storage.buckets/objects metadata。auth sessions/refresh tokens/provider key/DB password/環境secretはexportしない。Storage実体は別途コピーせず本番既存objectを削除/上書きしない（file削除事故の復元はこの案対象外）。
- 内容をstdoutへ表示せずTLS接続から暗号imageへ直接dump。catalog/集計だけを使うmanifestとchecksum・時刻・SQL hashを記録。現在のpostgresで他ownerをrestoreできない場合は、既存provider operator/ローカル既存supabase_adminでの手順を用い、新membershipを付与しない。
- 保管：公開成功から7日、未完了なら取得から最大14日。期限時にbackup image/付属manifestを削除、unmount確認。APFS/SSDの上書き消去は保証せず、passphraseの破棄を所有者が実施。OS/Time Machineのコピーがある場合は同期間で消去できることを前提にする。
- 復元：実顧客backupのlocalhost復元はまだ未承認なので、この案の承認に「暗号imageから同専用localhost DBへ必要範囲を一時復元、localhostだけ・外部通知停止・件数/制約/role整合確認後即volume削除」を明示して含める。Mailpit捕捉のみ、Auth email/provider接続なし。保持は検証当日のみ。先の合成backup復元PASSで所有者/SQL手順は検証済みだが実backup復元証明とは分ける。

最小の一度の確認は **上表の権限変更＋既存backupの読取確認（追加料金ゼロ）**。既存backupがない場合にローカルfallbackまで今回一度で許可するなら、保存先・個人情報/hash含むscope・鍵入力・保管期限・localhost一時復元/削除を上記のまま明示する。クラウド新project/PITR購入/外部メール/6件補完は含めない。

切替はwriter停止→backup確認/必要backup取得→SQL/hash/履歴/集計再確認→承認された権限変更と038〜050→tested SHAの公開→readonly smoke→writer再開。再開前の失敗はwriterを止めたまま復元可否を判断。再開後は取引喪失を避けrollforward優先、全DB restoreは実際の喪失範囲を提示して別確認する。

## 最終追加差分

051顧客自社請求SELECT/PDFだけ追加アクセス拡大を確認待ち。staff発行/送信/履歴読取は既承認範囲。旧storage_billing direct writerはコードにないため既存画面停止なし。Storage policyは既存supautils policy_grantsで管理可能。supabase_admin将来表default ACLだけ変更不能で扱いを確認待ち。Vercel ProjectはSupabase2変数だけ、Shared linkedなし。RESEND_API_KEY/RFQ_MAIL_FROM未設定。既存検証済みsenderと既存keyのProduction設定が必要。秘密取得/新key/外部送信なし。最新対象39テスト・全取引実DB/browser・RFQ復帰browser・build合格。専用localhost環境停止/volume削除済み。

14:50 UTCに051顧客自社請求PDFと内部将来table ACL残置での公開を承認。038〜051一括適用成功、052は既承認の内部RPC匿名拒否を本番の個別default grantにも合わせる最小撤回。supabase_admin将来table default TRUNCATEは了承済み残課題として未変更。メール設定/実送信は未合格。詳細は受入記録。
