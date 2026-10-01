# 案件フロー受入・公開区分

本番正本: main f5ae38655d54b8eaf3142badbcf4856b20f585ed（Stage1）。Stage2以降の業務台帳/権限/migrationは未公開。本表はローカル合格と本番合格を区別する。全ページ・全分岐完成の宣言ではない。

| 要件 | ローカル実装/受入 | 本番 | 未確認・外部依存 |
|---|---|---|---|
| 案件一覧・担当/期限・次操作・検索/戻る・モバイル | Stage1 UI/34browser、107source、代表業務 | Stage1公開済み | 現行本番認証画面の再監査未了 |
| 複数商品・仕様・数量候補・大中小分類 | 既存product_catalogとwizardのcategory_l1/l2/l3使用。原子的複数商品SQL受入 | Stage1公開済み | 正式taxonomyの全分類/最新資料整合は未確定。形状を推測しない |
| RFQ・登録済み工場・pending回答取込・採用候補 | Stage2実Auth/PostgRESTと採用preview | Stage2未公開 | 旧見積6件のvariant根拠なし。勝手な紐付けなし |
| 価格版・掛率/費目・固定FX | Stage3価格改訂版とSQL/画面受入。確認済み手入力FX、USD/JPY | Stage3未公開 | 最新FX自動取得/鮮度失敗動作、RMB費目、最新送料表反映未実装。手入力を自動取得合格と言わない |
| サンプル費・請求・実着金/発注 | sample ledger8表、SQL/native/PDF/Mailpit | 未公開 | 顧客の自社sample PDF権限は未追加。sample訂正の全分岐は未再検証 |
| 顧客見積回答→請求→実着金 | Stage4/8。全額/半金/後払、条件版・実着金区別、再読込復帰、PDF/Mailpit native | 未公開 | 本番メール設定/実到達合格は未確認。実取引先テストしない |
| 訂正・リンク更新・同版再送・銀行実施済み返金 | Stage10候補: SQL14/mail7。履歴削除なし、net着金で進行判定 | 未公開 | 受入結果はStage10 gate参照。金額変更済み請求の相殺/再配賦は未実装 |
| 工場条件・登録銀行・送金実績・着金/生産 | Stage5: 全額/部分/後払、manual facts、必要顧客前払guard | 未公開 | 実銀行送金APIなし。新たな口座を推測/生成しない |
| 工場QC・差戻し/実証再提出・部分承認 | Stage6/9。実Storage SHA、staff範囲判断、累積最大数量/原子的予約 | 未公開 | 全数量差戻しはSQL受入、nativeはnew_quantity差戻し。両方native合格としない |
| 送料/手配・運送通知・分納・顧客受領 | Stage7/9。物流割当、20/20/60実行、納品PDF/Mailpit | 未公開 | 海源送料正式表/丸め/追加料金・正確な住所正本未確定。FAINS/追跡APIは未接続、手動記録を明示 |
| 在庫・保管請求・送付 | 既存倉庫/保管請求のlocal native+Mailpit既存受入を維持 | 既存機能のみ | 新倉庫拡張は後回し。今回の全取引最終合成suiteへ未統合 |
| 連絡/チャット | Stage1連絡記録を整理 | Stage1公開済み | 外部送信/リアルタイムchat未接続。記録として表示 |
| 工場/物流/顧客の次操作・権限 | 工程別native role拒否/自社読取と390px証拠 | 新画面未公開 | 全routeの最終横断監査/統合回帰は未了 |

## 公開ゲート

fresh backup復元点・戻し方・以降の本番書込差分照合が未確認。Stage2/3は既承認、sample/Stage4–10の新台帳/RPC/各ロール権限は個別審査を統合する。既存31表の権限一覧はCODEX_STAGE3_7_PERMISSIONS_AND_REMAINDERS.md。Stage10は表追加なし。権限を含む新migrationをUI専用更新として公開しない。

実顧客data export/実取引先テストメール/実送金/追加課金/新credentialはこの受入に含まない。ローカルはlocalhost専用合成データを使い、受入後停止・volume削除する。
