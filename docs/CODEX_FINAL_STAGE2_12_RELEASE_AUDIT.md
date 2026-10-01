# 最終公開候補監査（Stage2–12＋最終修正）

本番はStage1 main f5ae38655d54b8eaf3142badbcf4856b20f585ed。ここに記載する候補はローカルのみ。対象15 focused / native再見積1 distinct（PDF注記追加後再確認）/ lint / typecheck / buildを最終版で確認。過去Stage12の48page・25 fixture browser・3 native受入を引き継ぎ、全suite再実行はしていない。

## 原要件との照合

- 大・中・小分類：product_catalogのlevel/parent_idに従う親子選択＋各段その他自由入力。ProductSpecEditor/新案件wizard/CaseProductsに接続。既存商品再分類は固定。正本全分類名称の網羅はseed不在のため断定しない。
- 商品→仕様→数量別候補：複数商品/複数仕様/複数量/複工場RFQ→候補採用→価格版→再承認がStage11/12 nativeで受入済。今回も数量4/8・別工場・CNY費目を含む実DB代表を確認。
- 案件上部の工程/不足/次操作/担当/期限、左nav折畳み、右会話pane折畳み、固定情報/旧連絡履歴の詳細表示は既存F&Cを維持。390px/desktop証拠はui-final-stage12/chat-stage12等。操作数の定量削減は未計測。
- 通貨：工場RFQは原要件通りUSD単価固定。費目USD/JPY/CNY選択は実処理あり、売価/請求JPY。全画面金額を曖昧に一括切替するボタンはない。工場CNY単価は未実装だが原仕様の必須とは確認できないため新機能追加しない。
- FXは日次参考値であり銀行決済/spot最新ではない。API由来新見積の発行時に最新提供元基準日時/値をno-storeで再取得し、採用版と異なれば発行停止・新価格版要求。顧客承認済請求は合意した版を維持する。手入力根拠は社内保存、公開PDFへは任意内部文章を出さない。新帳票notesにsource/as_of/rate固定。既存発行済みPDFを上書き/現在レートで再計算しない。

## 最終差分の証拠

15 focused PASS：FX発行停止/固定注記/手入力秘匿3、提供元鮮度3、メール8（設定なし送信/成功表示不可を追加）、配送要求scope1。
実Auth/PostgREST/Postgres再見積→顧客再承認→新請求→Mailpit合格。税込6600/引継着金550/未収6050/期限2026-10-31、取得PDFとメール添付byte一致。新注記を入れた合成発行済み文書から生成したPDFで参考FX/日次参考値/公開source/150 JPY/USD/20 JPY/CNYをテキスト抽出確認。FX発行actionのfresh比較はfocusedテスト、native側は合成発行済み文書のPDF投影受入でありUIからfresh発行のnative合格とは称さない。隔離nativeは合成FX feed、実API読取はStage12の別証拠。
ローカルreadonly preflight：missing tables/definers、RLS無効、直接write/匿名table権限、想定外anon definer EXECUTE、search_path逸脱、chat広範policyすべて0、private QC bucket1。合成DBの旧未紐付見積0は本番6件解消を意味しない。

## 適用順と最小権限（まだ本番適用しない）

manifestの14 migrationを昇順・sha256照合。第2/3の2 migration承認済、残り12は新権限審査対象。新表34＝第3承認済2＋未承認32（sample8/顧客精算7/工場6/QC4/配送6/既読1）。既存chat2表のRLS/直接write剥奪、sample宛先固定、CNY費目、配送履歴scope縮小を含む。038–052を再適用しない。実migration historyと候補欠番を照合してから実行。

営業/管理者：原価・サンプル費用/実支払/固定請求・共有・実着金・工場合意/手動実送金・QC判断・配送・メール管理を専用RPCで操作。直接write/TRUNCATEなし。
工場：自社RFQ/発注・条件/送金・着金/開始、自社製造QC提出/証跡、実中国発送だけ。顧客宛先電話/社内銀行照合/QC他社アクセスなし。
物流：本人割当便の中国受領/食品/輸送/配達実績だけ。金融/QC/他人便なし。
顧客：固定自社宛見積/請求・回答/入金申告・自社配送/受領・納品PDF・自社sample固定請求PDF。原価/社内費用/メール台帳/中国住所なし。申告は実着金と区別。
会話：営業が開く当該相手別室。顧客/工場自社かつ当該案件、物流割当本人だけ履歴/投稿/本人既読。旧peer欠損室は社内のみ、履歴自動公開しない。
配送要求：本人IDだけでの履歴読取を廃止し現在role/org/planも確認。元営業が顧客/工場/物流へ変更後はprepareの住所payloadを読めない。他社への組織変更も失効。scope失効後の要求復帰も拒否される。
QC private factory-qc：営業SELECT、自社工場INSERT/SELECT、PNG/JPEG/MP4最大50MiB、SHA検証、60秒read URL。UPDATE/DELETE・顧客物流・匿名不可。既存公開deal-images変更なし。
63 distinct SECURITY DEFINER namesすべて固定search_path。第2段の匿名能力endpoint ext_rfq_context/ext_submit_rfqだけ例外：期限/取消/招待factory/固定lineを検証する既存ランダム招待token。匿名台帳/finance/chat/QC不可。新auth boolean scope helperは存在/可否のみ。

停止リスク：新台帳を始めた案件は顧客承認/条件実着金→工場着金/製造→QC数量・残金→実発送/受領/納品書送付受付のgateを飛ばせない。旧事実を推測backfillしない。旧chat直接writeを使うarchiveを再公開しない。要求台帳/入金/請求/証跡はimmutable/idempotent、メールはpreview fingerprint一致、結果不明は自動再送しない。

## 公開/切戻しゲート

1. 既存providerのfresh成功backup/復元可能時刻とRestore手順を認証済read-onlyで確認。Sep29の旧点を最新と扱わない。backup以降の本番書込を止める時点を決め、件数/時刻/整合性を既存許可のreaderで照合。差分を消す復元はしない。export/課金/新credentialを代替に勝手に作らない。
2. 上記32表・chat・QC/private権限の承認後、candidate hash/history一致と既存6件の根拠/不足をreadonlyで確認。preflight-stage2-12-readonly.sqlはBEGIN READ ONLY＋30秒/2秒timeout＋集計NOTICEのみ＋ROLLBACK。権限不足はvisibility blockedで停止。ローカル実行済、本番未実行。適用前missingはpending、適用後0を要件とする。
3. 新write/メールを停止した保守窓に依存順DB→同tested SHAアプリ。DBと旧アプリの並走による旧直接writeエラーを避ける。認証/メールenvのsecret値を取得しない。production metadataと検証済送信元/APP_URLを照合、未設定なら送信不可を明示。外部テスト送信はしない。
4. prod migration ledger・remote main SHA・Vercel READY/alias・48page readonly role smoke。実取引変更なしの時点では本番全取引合格と言わない。
5. 不具合は新write/共有/送信停止→安全なread-only状態→限定権限と履歴を保持しforward fix。旧広いRLS復活/新表列drop/金融履歴deleteは禁止。provider復元が必要なら復元点以降の金融/請求/QC/配送/chat差分の保持・照合方法を先に承認。DBをそのまま古いwrite UIへ戻さない。秘密バックアップ場所未承認のままlocal exportしない。

## 48現役page公開smoke checklist

全行について正しいroleでread-only遷移、見出し/現在状態/不足/next action/戻る、empty/error/権限拒否、390pxとdesktopを確認。作成/採用/金銭記録/受領/送信は本番smokeで実行しない。既存ローカル48page fixture証拠を公開合格へ転記しない。

| route | 本番追加smoke |
|---|---|
| /analytics | 未実施・公開後read-only |
| /archive | 未実施・公開後read-only |
| /deals/[id]/documents | 未実施・公開後read-only |
| /deals/[id]/edit | 未実施・公開後read-only |
| /deals/[id] | 未実施・公開後read-only |
| /deals/[id]/production | 未実施・公開後read-only |
| /deals/[id]/quote-builder | 未実施・公開後read-only |
| /deals/[id]/samples | 未実施・公開後read-only |
| /deals/[id]/settlement | 未実施・公開後read-only |
| /deals/[id]/shipping | 未実施・公開後read-only |
| /deals/new | 未実施・公開後read-only |
| /deals | 未実施・公開後read-only |
| /docs | 未実施・公開後read-only |
| /inventory | 未実施・公開後read-only |
| /master | 未実施・公開後read-only |
| / | 未実施・公開後read-only |
| /settings | 未実施・公開後read-only |
| /account-invite/[token] | 未実施・公開後read-only |
| /external/[token] | 未実施・公開後read-only |
| /external/client-registration/[token] | 未実施・公開後read-only |
| /external/factory-registration/[token] | 未実施・公開後read-only |
| /external/logistics-registration/[token] | 未実施・公開後read-only |
| /external/rfq-response/[token] | 未実施・公開後read-only |
| /external/shipping-registration/[token] | 未実施・公開後read-only |
| /factory/login | 未実施・公開後read-only |
| /factory/messages | 未実施・公開後read-only |
| /factory/orders/[id] | 未実施・公開後read-only |
| /factory/orders/[id]/shipping | 未実施・公開後read-only |
| /factory | 未実施・公開後read-only |
| /forgot-password | 未実施・公開後read-only |
| /login | 未実施・公開後read-only |
| /logistics/login | 未実施・公開後read-only |
| /logistics/messages | 未実施・公開後read-only |
| /logistics | 未実施・公開後read-only |
| /logistics/shipments/[id] | 未実施・公開後read-only |
| /logistics/shipments | 未実施・公開後read-only |
| /portal/documents/[id] | 未実施・公開後read-only |
| /portal/documents | 未実施・公開後read-only |
| /portal/invoices | 未実施・公開後read-only |
| /portal/login | 未実施・公開後read-only |
| /portal/messages | 未実施・公開後read-only |
| /portal | 未実施・公開後read-only |
| /portal/samples | 未実施・公開後read-only |
| /portal/shipments/[id] | 未実施・公開後read-only |
| /portal/shipments | 未実施・公開後read-only |
| /print/request/[id] | 未実施・公開後read-only |
| /print/stock/[clientId] | 未実施・公開後read-only |
| /reset-password | 未実施・公開後read-only |

## 必須残課題と最小外部入力

海源正本全体は再提出不要。既監査版2025-06-15 sea包税RMB ordinary20/sensitive24 perkg、ticket課金重量max(実重,CBM×167,21kg)は既存requirementsに記録。現在calculateFreightのcm÷5000式はこのsea料金式ではないため自動正式送料と扱わない。必要なのは追加料/端数/特殊貨物/佐川追加、air/DQ通貨・費用包含・適用、複数商品ticketまとめ方と正式宛先/担当物流/追跡providerだけ。
食品届出と検査・費用は別、FAINS/追跡APIは未接続で手動正本実績を維持。新契約や外部書込なし。
旧見積6件は原仕様根拠/variantが不明のまま。閲覧/再発行を維持、新発注不可、推測紐付けしない。
本番メールkey metadata/検証済送信元/Production scopeを本人境界内で確認する必要。秘密の再送入力が必要なら本人操作。Mailpit合格は本番到達ではない。
将来supabase_admin作成tableのdefault TRUNCATE未変更は先の残置承認を維持、今回現在/新表に直接TRUNCATEは与えない。
