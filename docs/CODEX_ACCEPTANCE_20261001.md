# 10月1日朝の受入記録（進行中）

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
- 051の営業/adminによる発行・送信専用RPCと送信履歴のstaff限定読取は、既承認の「帳票発行・メール送信管理は営業/admin限定」と同じ業務権限。追加で確認するアクセス拡大は、clientがstorage_billingとdocumentsの自社保管請求をSELECT/PDF取得できること。他社・工場・物流・anonには公開しない。storage_billingの直接INSERT/UPDATE/DELETE撤回は旧直接編集を停止し、発行RPCだけへ移す制限変更であり、現状の保存/編集呼出箇所を確認して影響を提示する。TRUNCATE撤回は既承認と重複させない。

## 検証状態

保管請求の計算/入力3群、実source SQLのsnapshot/重複拒否/client分離/不正書込拒否/30日メール予約/失敗rollback、PDF生成をfocused3件PASS。PDF text抽出で日本語・12CTN・4,510円・8月・発行/支払日・振込先を確認。初回画像の日本語欠けは静的フォント全文埋込で修正し、1頁の画像で文字・余白・金額・日付を確認済み。追加の実DB/Mailpit添付・browser・最終lint/type/buildは未完了。

公式Supabase資料はsupabase_adminを内部管理用ロールと説明し、利用者へのsuperuser提供はない。既存postgres接続で内部ロールdefault ACLを変更する公式手順は確認できなかった。代替範囲は既存public全表とpostgresが今後作る表のTRUNCATE撤回（今回のアプリmigration含む）。内部ロールが将来作る表の既定権限のみ未適用となり、将来の管理側新表を点検する必要が残る。完全撤回が必要ならユーザーから既存Supabaseサポートへproject uocpewtmhmdfhdvnrljlのsupabase_admin/public/table default ACLのanon・authenticated TRUNCATE撤回だけを依頼する。認証情報/ロールmembership追加や権限迂回はしない。

追加の実actionを依存置換して保管請求PDF添付・宛先/金額/期限・恒久予約、受理応答消失/receipt保存失敗/拒否で再POSTなし、PDF失敗は予約なし、外部role拒否、在庫写真の実案件pathと新blobだけのrollbackを確認。mail/Storage対象31件とSQL/PDF3件が合格。長い会社名/住所と最大長の根拠/振込先の3頁PDFは全文の用紙内bounds、量/金額/年月/期限の抽出、画像を確認。最新差分でlint/typecheckも合格、buildと実DB/Mailpit/browserは未実行。

PhantomのZIP worker2検証中はBAOの新規重いbuild/Docker/E2Eを開始せず、コード精査・小規模試験・PDF画像確認を進める。完了通知後に重い検証を直列実施。

## 朝の確認手順（公開後にのみ本番で）

staffログイン→案件作成→仕様/数量→RFQ→登録工場回答/未登録の明示取込→採用→請求/発注→物流入庫/検収→在庫→保管料の確定量/契約根拠→請求書発行→PDFの量/金額/期間/期限→送付先確認→顧客ポータル自社請求閲覧→顧客出荷依頼→staff確認→物流出荷/納品。
朝の確認で実取引先へのメール送信は、宛先と内容をユーザー自身が確定するまで行わない。旧6件は各案件に内容入り仕様候補1件ずつがあるが、見積spec_id/variant_id・商品階層・見積source_file・仕様existing_quote_file・RFQ回答・帳票snapshotはいずれもない。仕様が採用時の正本かを確認できず、推測補完せず未解決を維持。手動確認の最小scopeは6件それぞれの採用元見積と当時の仕様/数量/工場の一致、採用時の変更履歴、今後の発注に使う商品/variantの根拠。ID/名前/価格/原文は本記録へコピーしていない。
