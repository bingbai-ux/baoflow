# 物流原資料と旧6件の照合（2026-10-02）

## 別々に適用する物流根拠

- 海源食品届：親が原メールを確認（2026-07-31 18:13、Kaigen岩佐）。Kaigenは正しい検査報告に基づいて食品届を作成するが、報告の正否は判定しない。供給者/依頼側が正しい読める食品接触材料の証拠を用意する。現行発送計画のfood_basisには資料の版/対象材料/確認者を記録し、inspection_readyとinspection_clearedを実施事実で分ける。メールだけで検査不要や通過済みにはしない。https://mail.google.com/mail/u/?authuser=bing.bai%40foodandcompany.co.jp#all/19fb77354725c802
- YP Express：親確認の元管理表（改訂表記Apr25）には約20日船、箱ごとceil(L×W×H/5000)×箱数、受取先「义乌宝湾物流园3楼3栋4号门／老李／13566714204」。既存logistics-engineの式はこのYP資料系と整合するが、海源のCBM×167/21kg式とは違う。現行性・登録provider/methodとの対応未確認。受取先は参考資料に保持し、海源/air/食品共通住所へ自動入力しない。https://docs.google.com/spreadsheets/d/1h1Pfg7eDxqTg3jSF3zii6QqqauB2qmuzLlHksStzgnA/edit
- Kaigen外部請求案内：親確認Sept15メールで2026年12月メール配信終了、2027年から外部ダウンロード。BAO顧客請求メールとは別。外部請求書取得/照合は担当による取得が必要、認証やAPIを推測しない。BAOの顧客メールを停止しない。

完了条件：利用する便の現行個別見積（追加料・端数・区分混載・税込/含有範囲）、providerと船/air/食品区分に対応する現行受取先と担当確認、食品報告の材料/商品対象と正否の確認者、実食品手続/輸送イベントの正本。追跡APIが未提供なら手動の実績記録を明示する。自動連携の完了とは言わない。

## 旧6件の発見と訂正

新構造products/variantsやquote.spec_idは欠損しているが、旧deal_specificationsは全6案件に1件ずつ残存し未編集。したがって「旧仕様がない」は誤り。元の011_seed_data.sqlが6案件すべてを初期投入している。DBの仕様/見積作成日は全件2026-09-14で実見積日とは断定不可。
全件のdesign_files/documents/deal_communications/RFQ/factory_purchase_ordersは0、quote source_file_url/factory_response/existing_quote_file/参考画像もなし。ローカル営業CRM/工場クライアント兼用管理表には顧客名/旧商品名一致0。原取引見積を発見したとみなさない。

検索キー（DB既存metadata）：
|案件番号|顧客|旧商品名|
|---|---|---|
|PF-202602-001|ROAST WORKS|クラフト紙スタンドパウチ250g|
|PF-202602-003|gelato BENE|PETアイスカップ280ml|
|PF-202602-004|抹茶一期|抹茶保存缶100g|
|PF-202602-005|Burger CRAFT|バイオマスレジ袋Mサイズ|
|PF-202602-006|ROAST WORKS|テイクアウト用リッド12oz|
|PF-202602-007|gelato BENE|ホールケーキ用化粧箱5号|

安全な修正案：旧仕様と初期投入根拠を読取表示し、元数値/採用/旧PDFを保持する。実取引なら原仕様と工場見積との対応を確認した新商品/variant/価格版を作成し、旧見積は勝手に転用しない。初期投入だけのデータなら、その確認結果に基づく扱いを決める。架空/不要と推測して削除・自動archiveもしない。唯一の同案件旧仕様があるだけで、工場がその仕様を承認した証拠とはしない。
