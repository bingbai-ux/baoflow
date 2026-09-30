# 10月1日朝の受入記録（ローカル合格・本番保留）

公開URL候補 `https://baoflow.vercel.app`。本番公開は未実行。最終tested SHAは追加範囲の検証後に確定する。以前の代表実Auth/PostgREST/Postgresの案件→仕様→RFQ→回答→採用→帳票→発注→入庫→出荷→納品PASSは、現在の追加差分全体の合格と混同しない。

## 本番バックアップを画面で確認

ユーザーの既存Chromeでproject `uocpewtmhmdfhdvnrljl` / baoflow-v2 / main PRODUCTIONへログイン済みを確認。
Scheduled backupsのPHYSICAL 7世代：9/29 21:56:58、9/28 21:53:51、9/27 21:55:36、9/26 21:55:02、9/25 21:54:28、9/24 21:53:39、9/23 21:53:48（全2026 UTC）。各Restoreが利用可能。最新のRestore確認画面だけを開き、「9/29 21:56:58へ復元」「復元中offline」「新data喪失」「取消不可」を実際に確認しCancelした。復元は実行していない。PITR画面はadd-on未契約。課金/設定変更なし。

追加のREAD ONLY集計：publicのcreated_at/updated_atを持つ52表のbackup後更新0、最新timestamp9/26 15:30:37.155205 UTC。deal_status_history変更0、新auth.users作成0、Storage object作成/更新0。timestampを書かない変更や削除がなかったことの証明ではない。Storage file実体はDB backupに含まれず、今回既存fileを削除/上書きしない。writer再開後の全DB復元は取引を失うため、喪失範囲を別確認しrollforwardを優先する。

## 本番権限の阻害要因

本番SQL actor postgres、superuser=false、supabase_admin MEMBER=falseをREAD ONLY確認。承認された既存53表/新表とpostgres default ACLは別として、supabase_admin自身のdefault ACL変更には所有者/既存権限あるprovider operatorが必要。新membership/credentialを作って迂回しない。本番DDL/DML・権限変更・migration・GitHub push/merge/deployはまだ実行していない。

## 今回見つかった追加不足と修正候補

- 保管料は現在庫×単価の概算だけで正式請求保存/添付メール未実装だった。051候補はクライアント/月の重複防止、元請求・会社/料金/量/日付/宛先/振込先のsnapshot、採番と請求保存の原子性、本人再試行復帰、永久メール予約を追加。
- 過去のcarton履歴が存在しないため、月末/平均量を捏造しない。倉庫台帳/契約で確定した量・回数・単価・根拠をstaffが明示確認して発行する。現在庫概算を正式請求と扱わず、自動月末計算/自動送信スケジューラは未実装。
- PDFは日本語フォントを組み込み、実PDFの量/金額/日付/支払情報を抽出し画像確認する。PDF生成後に送信予約し、受理応答消失/DB保存失敗では再送しない。到達は隔離Mailpitだけで検証し、本番取引先へ送らない。
- 在庫写真は旧inventory/item pathが050により拒否されるため、staff＋実在の非archive案件配下へ変更、DB履歴保存失敗ならblobを取消。案件なしの商品への写真uploadは根拠ある紐付けまで不可。既存写真URLは保持。
- 051の営業/adminによる発行・送信専用RPCと送信履歴のstaff限定読取は、既承認の「帳票発行・メール送信管理は営業/admin限定」と同じ業務権限。追加で確認するアクセス拡大は、clientがstorage_billingとdocumentsの自社保管請求をSELECT/PDF取得できること。他社・工場・物流・anonには公開しない。storage_billingの直接INSERT/UPDATE/DELETE撤回は発行RPCだけへ移す制限変更。既存コードに直接writerはなく、既存画面の停止はない。TRUNCATE撤回は既承認と重複させない。

## 最終ローカル検証

追加修正を含む対象39テストPASS（mail/Storage 31、storage SQL/PDF 3、UUID復帰4、旧6件の合成migration1）。実Auth/PostgREST/Postgresと画面の全取引1ケースPASS、RFQの保存成功後応答消失→再読込復帰1ケースPASS。最終 `npm run build` はlint/typecheckを含みPASS、production PDF routeのtraceに日本語fontが含まれることも確認。

| 工程 | 隔離ローカル結果 |
|---|---|
| 案件・仕様・RFQ・工場回答・見積採用・帳票請求・発注 | PASS。RFQ結果画面が即時再検証で消える問題も修正し、再読込で同じ招待へ復帰 |
| 工場閲覧・入庫検収・在庫・実Storage写真 | PASS。1,000pcs/10CTN、staffの実案件path写真保存 |
| 保管料・正式請求・PDF添付メール | PASS。確認済み10CTN、3,960円、2026-09、期限10/31、振込先1234567。隔離Mailpit実到達の添付PDFをUnicode抽出・用紙内bounds・画像で確認。受理後再試行でも同件名の到達1通 |
| 顧客閲覧分離 | 自社PDF200、工場/物流404。SQLで他社拒否もPASS |
| 顧客出荷依頼・営業確認・出庫・納品 | PASS。在庫0、案件納品済み |
| 旧見積6件の互換migration | 各案件に内容入り仕様候補1件を再現。旧quote/帳票/入出庫を保持、再発行採番継続、不明な紐付け/新発注を拒否 |

入金は手動の状態確認であり実決済を実行していない。過去の在庫量履歴がないため、平均/月末保管量は倉庫・契約の確認値をstaffが入力する。月末自動計算・自動送付・発行済み請求の訂正/再送自動化は未実装。外部Resend到達・実取引先送信・本番全取引は未検証。

検証環境の古いSQLコピーを検知して、顧客seedを除く正本SQLで専用localhost環境を再作成し001〜051を適用。runnerはsource一致と要求本人読取RLSを先に確認する。実顧客dataのコピーなし。PDFの日本語欠けとLatin数字のUnicode誤対応は静的font全文埋込・代替glyph機能無効化で修正し回帰試験へ追加した。

## 公開前の残る判断と設定

1. 051の顧客自社 `storage_billing` / 関連 `documents` SELECTとPDF取得だけが追加アクセス拡大。営業/admin発行・送信管理は既承認。storage_billingの旧直接writerはコードに存在せず、RPC限定化で既存UI停止はない。発行済み請求は変更不可。
2. supabase_adminの将来public表default TRUNCATEだけ現接続で変更不可。現存53表は全postgres所有で撤回可、今回の新表・postgres将来表も保護可能。この残余を未適用として監視する代替範囲を採用するか、既存Supabaseサポートへ内部ownerのdefault ACLだけ変更依頼するかを確認待ち。membership/credential追加や迂回はしない。
3. Vercel既存ログインのProject/Shared設定を読取確認。ProjectはSupabase URL/anon keyの2件（All Environments）、Sharedはlinkedなし。`RESEND_API_KEY` / `RFQ_MAIL_FROM` / `NEXT_PUBLIC_APP_URL` は登録なし。メール送付には既存の検証済み送信元と既存APIキーをユーザーがVercel Productionへ設定する必要がある。秘密の取得・新key作成・外部テスト送信はしていない。

Storage所有者はsupabase_storage_adminだが、既存supautils policy_grantsがpostgresにstorage.objects/bucketsのpolicy管理を認めていることをREAD ONLY確認。承認済み050の2policyはこの正式な既存権限で操作可能で、新membership/config変更は不要。[公式supautils policy管理](https://github.com/supabase/supautils#manage-policies)。同機構にdefault ACL代替手順は確認できない。

本番migration最新037、GitHub mainのSHA `363229a45fe5b56966563306deda2919a66809c3`、既存production deployment `dpl_8kv6JeHGQB9kVWtArojx8QAmxHpk` のまま。DDL/DML・権限変更・push/deployは未実行。公開前にwriter停止とbackup後の変更集計を再確認する。再開後の失敗は取引を保持するrollforward/app rollbackを優先し、全DB復元は復元点以降の喪失範囲確認が必要。DB復元でStorage実体は戻らない。

## 朝の確認手順（公開後にのみ本番で）

staffログイン→案件作成→仕様/数量→RFQ→登録工場回答/未登録の明示取込→採用→請求/発注→物流入庫/検収→在庫→保管料の確定量/契約根拠→請求書発行→PDFの量/金額/期間/期限→送付先確認→顧客ポータル自社請求閲覧→顧客出荷依頼→staff確認→物流出荷/納品。
朝の確認で実取引先へのメール送信は、宛先と内容をユーザー自身が確定するまで行わない。旧6件は各案件に内容入り仕様候補1件ずつがあるが、見積spec_id/variant_id・商品階層・見積source_file・仕様existing_quote_file・RFQ回答・帳票snapshotはいずれもない。仕様が採用時の正本かを確認できず、推測補完せず未解決を維持。手動確認の最小scopeは6件それぞれの採用元見積と当時の仕様/数量/工場の一致、採用時の変更履歴、今後の発注に使う商品/variantの根拠。ID/名前/価格/原文は本記録へコピーしていない。
