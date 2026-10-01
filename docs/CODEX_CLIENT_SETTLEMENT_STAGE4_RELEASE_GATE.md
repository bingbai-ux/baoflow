# 第4段：顧客承認・請求・実着金確認（ローカル受入）

基点9c2c9a9。候補migration `20261001121648_client_settlement_v1.sql`。本番未適用・未公開。第1段の本番main f5ae386とは区別する。

## 実装と事実の区別

- 営業 `/deals/:id/settlement`：既存発行版の顧客向けプレビュー→確定共有。原価・工場価格を含めない固定snapshot。案件と帳票への戻りを維持。
- 顧客 `/portal/documents`：自社有効版の検索・見積回答・請求PDF・振込後の申告。顧客Auth必須。ランダムなメールリンクはpacketと7日期限を限定し、token単独で認証しない。期限切れ後も自社ポータルから有効な帳票を開ける。
- 顧客承認≠営業による見積確定。顧客入金申告≠BAO実着金。実着金記録≠自動工程反映。銀行照合番号を正規化してuniqueにし、全額確認後の明示操作のみpaidへ進む。部分着金は残額を残す。
- invoice発行・共有は現採用価格の顧客承認後。商品仕様・数量・売価・税抜/税込額の変更は旧承認を新条件へ流用しない。共有済み帳票と回答/実着金履歴は変更/削除しない。旧帳票は既存画面で閲覧し、顧客IDが凍結されていない版を推測補完しない。
- 実着金のある請求取消は禁止。見積改訂は依存する有効請求書を先に取消する必要がある。返金・信用伝票・実着金訂正は未実装。
- 送付前に宛先・本文・PDFを確認。永久送信予約を先にcommitし、provider受付後のDB保存失敗/応答喪失/拒否/長期retryでも2回目POSTをしない。受付は到達証拠ではない。通常の同版再送・期限延長UIは未実装（自社ポータルの確認は継続可）。
- 再読込復帰は本人のUUIDとSHA256だけをsessionStorageへ保存する。token・口座情報・フォーム内容は保存しない。通知は「入金申告・BAO実着金確認待ち」で既存通知一覧へ。通知取得エラーから再試行でき、仮の「すべて既読」表示を除いた。

## 観測済み検証

最終候補SQL/メール対象10件PASS（6SQL+4action）：他社・他role・期限切れ/偽リンク、再送停止、価格変化、取消後の手動進行拒否、同じ要求/自然キー重複、銀行参照重複、部分入金、DB後段失敗のrollback、権限降格後の要求秘匿、直接write/TRUNCATE/anon RPC拒否。

合成ブラウザ1件PASS：営業空状態→既存帳票への移動、顧客空一覧→利用不可リンク→自社一覧への戻り、390px横溢れなし。実localhost受入1件PASS：新規作成した専用DBに候補全migration適用、実Auth/PostgREST別sales/client/foreign/factory/logistics。顧客見積承認→invoice共有→申告成功応答喪失→再読込復帰（要求保存はUUID/SHAのみ・申告1件）→営業銀行確認→明示paid→PDF取得→Mailpit到達/宛先/金額/期限/添付bytes一致→他社/工場/物流PDF404。

PDF文字抽出で2個/¥1,100/2026-10-31/商品名を照合、原価非表示、実画像確認。lint/typecheck/build PASS。重い全suiteは再実行していない。証拠 `artifacts/client-settlement-stage4/` は合成データのみ、Library ID未取得。before画像は既存機能が無いため未作成。初見の理解時間や操作削減数は未計測。

本番の顧客承認・メール到達・銀行照合を実取引で試していない。第5〜7段、後払/半金条件・自動最新FX・顧客入金取消/返金はこの受入に含めない。

## 本番権限の追加承認対象（まだ適用しない）

新表7つ：client_document_packets / client_document_links / client_document_responses / client_payment_reports / client_payment_receipts / client_finance_requests / client_document_mail_receipts。

- 営業/管理者：packet/link/response/report/receipt/mail履歴をSELECT。要求は本人だけ。preview_client_document / client_finance_command のstaff操作で共有・取消・申告否認・実着金記録・既存status RPCへの明示反映。claim/finish_client_document_emailで送付管理。直接write/TRUNCATEなし。
- 顧客：自社packet、本人かつ現在自社のreport、本人かつ顧客操作のrequestのみSELECT。client_finance_contextで自社有効版/PDF/自分の申告/確認合計のみ。client_finance_commandは自社見積の回答とinvoice申告だけ新たにwrite可能。銀行明細照合番号・staff要求・リンク表・メール履歴は読めない。金銭移動・paid更新・送信は不可。
- 工場/物流/anon：新表閲覧/書込、金融PDF・金融RPC利用不可。authenticated EXECUTEでも実行時role/partyをチェックし、anon/PUBLICのEXECUTEなし。
- 既存deals/documents：新共有履歴のある案件だけ現価格承認・全額実着金の進行guard、invoice発行guard、共有版不変triggerを追加。共有取消で従来手動進行へ戻す抜け道も拒否する。新共有を始めていない旧案件の既存業務は維持。

Auth設定/Storage policy/default ACL変更なし。既承認の保管請求閲覧権限とは、今回の量産見積/請求閲覧・回答/申告writeは別。第3段/サンプル/第5〜7段の権限案とまとめる。現在branch HEAD全体を第2段のリリースbranchと混同してpushしない。

## 公開/復旧ゲート

現本番migration履歴・既存data件数/欠損構造をread-only確認→最新成功provider backupとRestore手順/backup後書込差分確認→対象権限承認→同tested SHAの候補migration→アプリ反映→安全なreadonly smoke。現バックアップ確認/本番適用/公開はこのローカル受入で解消しない。

戻し方は新規共有/送付/着金操作を止め、固定版/履歴を残した互換アプリへforward fix。新table DROPや既存見積/receiptの削除をrollbackとしない。新共有済み案件で旧UIだけへ戻すと承認/着金guardにより進行できないため、少なくとも対応viewerとstaff金融画面を残す。backup復元はbackup後の実取引書込も失うので、利用者停止と差分判断が必要。
