# サンプル独立手配・まとめ請求：ローカル受入と公開境界

基点d381521。候補migration `20261001111822_sample_ledger_v1.sql`。本番未適用。第2段RFQ・第3段価格改訂とは別の追加権限であり、同じ本番承認に含めない。

## 実装

案件→サンプル手配画面。商品/仕様・工場・数量・希望期限を持つround、概算費用、確認済み実費と顧客負担、手動工場支払を別記録にする。UPS/FedEx送料と製作費/版代を分離。概算だけでも保存可能だが請求対象外。USD実費は確認済みの手入力FX根拠・日時を保存し、155等のfallbackや自動最新換算をしない。顧客負担額は明示した税抜円額で、半額・税を推測しない。

標準は先に手配・記録、後日未請求費用を選択してまとめ請求。前払/量産見積採用gateなし。プレビューは番号・予約・token・台帳を書かない。確定時は案件と費用lock、部分uniqueで有効請求割当を保護し、PDFsnapshot/割当/要求履歴を原子保存。取消は理由・日時を記録して有効割当を解除、再発行は新番号と旧請求参照。費用の誤記は未請求の理由付き取消と新記録で訂正する。元の費用とPDFは残す。

旧deal_samplesは折り畳み読取専用、旧金額を再計算・自動移行・再請求しない。新roundは新旧の保存番号の最大値+1を案件lock下で採番し、番号を再利用しない。旧deal_sample_summary/見積6件は変更しない。

画面は手配/未請求/請求履歴の作業切替、検索、状態ごとの次の作業、担当工場/期限、明確な未記録・処理中・失敗・保存後表示。保存UUID/SHA256だけをsessionStorageへ永続化し、入力・連絡先・支払情報を保存しない。成功応答喪失後も本人の要求結果を再取得する。

PDFは商品/仕様・round・数量・費目・顧客負担・税・合計・発行/支払期限・振込案内・発行者を凍結。再取得と添付は同じ保存内容。メールは宛先/送信元/文面/PDF SHA確認後に永続予約し、受付応答喪失・履歴保存失敗・拒否でも自動再POSTしない。受付は到達/入金とは別表示。

## 本番で新しく必要な具体承認

全8表：sample_rounds / sample_estimates / sample_costs / sample_payments / sample_invoices / sample_invoice_lines / sample_requests / sample_mail_receipts。

現状は存在しない→全表RLS、authenticated SELECTのみ。営業/管理者のみ読取、sample_requestsはさらに要求本人限定。顧客/工場/物流/匿名には新表読取・PDF読取を付与しない。直接INSERT/UPDATE/DELETE/TRUNCATEはPUBLIC/anon/authenticatedから撤回し、専用RPCだけで記録する。顧客へのPDF添付送付はstaffの明示確定で行う。顧客ポータルの新請求PDF読取は今回未実装・未承認である。

- preview_sample_invoice(uuid,jsonb)：営業/管理者専用の読取計算。
- sample_command(uuid,uuid,text,jsonb,jsonb)：営業/管理者のみ。手配/概算/実費/支払証跡/状態/請求確定/取消/費用取消。所属案件とactive状態、要求UUID/payload、費目割当を検証。
- claim_sample_email(uuid,jsonb)、finish_sample_email(uuid,uuid,text,text)：営業/管理者のみ。永続送信予約、予約した本人の結果確定。他role/匿名は拒否。
- keep_sample_record trigger：概算・実費・支払・要求履歴の上書き/削除禁止。roundは状態のみ、費用は理由付き取消のみ、請求は理由付き取消のみ、請求割当は取消時解除のみ。発行snapshotは変更禁止。

新Storage/Auth/公開読取/default ACL/外部token/課金/実送金は追加しない。既存表writerを撤回せず、旧サンプル機能はschema互換を保つ。

## 復旧

使用開始後は新規サンプル記録・新請求・新送信を停止し、既存記録/PDF/送信予約を保持してforward修正する。対応画面を戻しても保存済み表/履歴はDROPしない。取消は記録上の訂正であり、既に到達したPDFや実送金を取り消す機能ではない。送信不明はprovider確認まで再送禁止。顧客入金・工場着金確認は後続段階であり、支払証跡から成立を推定しない。

## 受入証拠

対象PGlite/アクション/復帰試験、実localhost Auth/PostgREST/Postgresの1browser、PDF Unicode/bounds/画像、lint/typecheck/buildを直列確認する。実ブラウザは2商品/2round、概算→実費、独立工場支払、請求1650円、Mailpit宛先/本文/期限/PDF bytes一致、取消再発行、同時採番3/4、同一費目の競合請求1成功1拒否、応答喪失→再読込同一結果、390px横溢れなし、旧1234円の保存値閲覧を確認する。

画像はartifacts/sample-stage3、合成情報のみ。新画面のafter証拠であり、旧版との同データbefore/afterやLibrary配信済みとは扱わない。Mailpit到達は本番Resend接続/実取引先到達の合格ではない。

## 後続の残項目

| 段階 | 現在の境界・次の受入 |
| --- | --- |
| 第2段RFQ公開 | e9ec145限定release branch。承認済み、親の最新backup確認待ち |
| 第3段価格改訂公開 | 0d9af18候補。追加権限/不変履歴の承認待ち、最新自動FX・RMB・未確定海源料金は未実装 |
| サンプル公開 | 本候補の具体承認・backup・migration→対応アプリが必要。顧客自社ポータルPDF/着金確認は未実装 |
| 第4段顧客承認・請求入金 | 顧客申告とstaff実着金の独立台帳、条件別請求・旧版/部分入金検証が必要 |
| 第5段工場条件・支払・製造検品 | 工場最終条件版、振込記録と工場着金別記録、製造/証跡/BAO検品の独立条件が必要 |
| 第6段輸送・海源 | 宛先分岐、食品検査、海源受領/輸出、分割shipment/追跡。未知carrier/provider料金は未接続と表示 |
| 第7段受領・納品 | 配達と顧客受領の別記録、分納/未受領、納品書添付送付。倉庫在庫と製造案件完了の分離 |

全取引・全ページ完成とはまだ扱わない。第4以降は既存実装を再利用し、未記録の業務事実をステータスだけから作らない。

## 最終結果

対象16件（SQL8、mail action4、UUID復帰4）PASS。実localhostブラウザ1件PASS、軽量合成モバイルshell/検索/内側scroll1件PASS。専用DBは空volumeから候補全migrationを起動して確認し、最後にcontainer/volumeを停止・削除、残存0。PDFのUnicode文字・商品/round/数量/費目/税/1650円/発行・期限/発行者、用紙内boundsと実画像を確認。最終lint/typecheck/build PASS、production PDF traceに日本語fontを確認。

viewport画像は既存shellの撮影下端に重複描画が映るため、モバイル作業面の一次視覚証拠はGPU無効化・main領域撮影のworkbench-main-390.pngとする。DOMメニューは1個、内側scrollと横溢れなしを確認。画像を修正/合成せず、元viewport証拠も保持。認証済み本番のこの新画面は未確認・未公開。

未実装：自動FX/RMB/carrier連携、顧客ポータルの新サンプル請求読取、顧客入金・工場着金確認、値引き/返金の正式台帳、工場支払証跡の訂正操作。手動支払記録を着金済みと表示せず、これらを全取引完成に含めない。
