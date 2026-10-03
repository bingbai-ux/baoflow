# 第8段：顧客の全額・半金・後払条件（ローカル候補）

候補 migration `20261001162000_client_payment_conditions_v1.sql`。本番未適用、31新表を増やさない。固定顧客見積版の snapshot.payment_conditions に条件を保存し、顧客承認後の請求版へ継承する。旧snapshotは全額前払い。顧客承認済み条件を後から上書きせず、修正依頼→新見積版→再承認で変更する。

全額前払は発注前・発送前とも税込総額、半金は発注前に税込総額の半額（1円端数は前払側）、残金は発送前または納品後を明示。後払は発注前/発送前の必要着金0で、承認済み見積と固定請求版は必須。支払期限は請求書の固定日付を保持し、金額を減らした請求書や債権消去にはしない。自動FX・未確認料率・実振込なし。

既存paid工程は表示を「支払条件確認済み」に変更し、全額実着金の意味にしない。実着金・未収はreceipt合計で別表示、client_finance_context.paid_in_fullは実際の全額のみ。案件完了後も請求版と未収を保持する。

既存の工場発注insert guardは第5段に既に存在する。本候補はその全額条件を顧客が承認した発注前額へ変更する。発送計画・輸送イベントinsertでは顧客の発送前必要累計額を確認し、工場への残金/QC gateとは独立に両方成立させる。旧finance台帳なし案件に新たな根拠を推測登録しない。

## 権限と互換

新しい公開RPCは preview_client_document_with_terms(uuid,uuid,text,text)。authenticated実行可だが内部で営業管理者だけを許可。既存client_finance_commandのcaller/対象/要求ID/atomicityを維持。金銭・条件計算helperはPUBLIC/anon/authenticated EXECUTEを撤回。新表・新Storage・Auth・永続credential・default ACL変更なし。既存の自社顧客だけが固定公開条件を閲覧・見積回答、営業だけが実着金を確認。リンクTTL7日/ログイン必須、QC署名read60秒は変更なし。

アプリは新preview RPCが必要なので migrationとアプリを同版で公開する。旧アプリの条件なし公開は全額前払へ倒れるため、半金/後払を開始後に旧アプリだけへ戻さない。復旧は新規操作停止、固定版/未収の互換閲覧維持、forward fix。台帳DROPや受領金額改変で戻さない。

## 受入状況

合成SQLでは全額旧版互換、半金未満の発注拒否・前払後発注・発送前残金拒否、半金残額後払/全額後払の未収保持、価格drift拒否、1円端数、顧客修正→条件新見積→再承認→請求継承、他role preview拒否を確認する。localhost実Auth/PostgREST/画面/PDF/Mailpitと最終lint/type/buildは実行結果を追記するまで未確定。

受入結果：対象19件PASS（精算SQL10＋メール4＋復帰5）。localhost実DB/実Auth/PostgREST/画面/Mailpitは半金、後払、旧全額精算、工場QC→食品輸送→部分受領→納品の4件を同じ版・worker1で直列実行してPASS（50.0秒）。半金は営業画面で条件選択・プレビュー・共有し、顧客承認、550円実着金前のPO拒否、着金後の実PO作成と未収550円保持。後払は営業画面から固定共有・顧客承認後、receipt0件で実PO作成し未収1100円保持。実外部メール/送金なし。合成半金・後払の各PDFで条件・税込総額1100円・2026-10-31期限・ページboundsを確認し、Mailpit添付bytes一致。390px横溢れなし。証拠はartifacts/client-payment-conditions-stage8。4件は別合成案件であり、半金からQC/納品まで同一案件の完全結合を示すものではない。分割請求/カスタム比率/返金訂正は別残課題。

最終lint（警告0）/typecheck/build PASS。バックアップ認証と本番新権限承認は未完のまま、本番適用/push/deployなし。
