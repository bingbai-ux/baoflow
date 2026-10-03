# 第3段・サンプル・第4〜12段：公開権限と総残表

第2/3段は親から承認済み、現行backup認証/復元点確認待ち。サンプルと第4〜9段は以下の追加境界をまとめて審査。本書は適用承認ではない。本番変更なし。

| 対象 | 新表/保存先 | 営業管理者 | 工場 | 担当物流 | 顧客 |
|---|---|---|---|---|---|
| 第3段（承認済） | quote_cost_lines / quote_pricing_requests、deal_quotes.pricing_snapshot | 新価格/費目/FX版作成、本人要求復帰、固定PDF | 追加なし | 追加なし | 追加なし |
| サンプル | sample_rounds / sample_estimates / sample_costs / sample_payments / sample_invoices / sample_invoice_lines / sample_requests / sample_mail_receipts | 8表読取/専用RPCで手配・実費・支払記録・まとめ請求・取消・メール管理、PDF | なし | なし | Stage12で発行時確定した自社宛の固定請求/PDFだけ。原価/支払/メール履歴不可、旧宛先欠損は非公開 |
| 第4段 | client_document_packets / client_document_links / client_document_responses / client_payment_reports / client_payment_receipts / client_finance_requests / client_document_mail_receipts | 共有/取消/実着金確認/進行/メール管理 | なし | なし | 自社有効固定版/PDF、見積回答・入金申告。申告≠実着金。内部銀行番号/リンク/メール台帳不可 |
| 第5段 | factory_final_terms / factory_terms_agreements / factory_transfer_reports / factory_bank_acknowledgments / factory_production_starts / factory_workflow_requests | 登録銀行原文照合・条件同意・実手動送金の記録・工程反映 | 自社条件提示/送金読取/自社着金確認/実製造開始。営業の銀行照合根拠は非公開 | なし | なし |
| 第6段 | factory_qc_assets / factory_qc_submissions / factory_qc_reviews / factory_qc_requests、private factory-qc | 証跡読取・最新QC判断。Storage SELECTのみ | 自社製造済み発注の証跡INSERT/SELECTと完工提出。Storage上書き/削除不可 | なし | なし |
| 第7段 | shipment_plans / shipment_milestones / shipment_customer_receipts / shipment_delivery_documents / shipment_workflow_requests / shipment_mail_receipts | 固定配送版・全体読取・納品書/PDF/通知管理・明示案件反映 | 自社中国宛先/方法/数量、国内実発送のみ。顧客最終住所/電話なし | 指定本人の便だけ、実中国受領/食品/輸送/配達。金融情報/QC Storage/納品書なし | 自社公開配送/数量/実受領/納品書PDF。内部情報源/中国住所なし |

計31新表（サンプル8＋第4段7＋第5段6＋第6段4＋第7段6）。第3段の承認済2表は別。すべてRLS、直接write/TRUNCATEなし、限定RPC・固定search_path・実行時role/対象確認。要求台帳は本人。匿名の新EXECUTEなし。唯一の新Storageはprivate QC PNG/JPEG/MP4、50MiB、60秒read URL。既存公開deal-imagesは変更なし。Auth/新credential/default ACLの追加変更なし。将来supabase_admin作成tableのdefault TRUNCATE残課題は既承認の残置を維持。

既存機能の停止影響：新版価格/共有帳票は直接訂正不可で新固定版が必要。新金融案件は顧客承認/合意条件の実着金なしに発注へ進めない。新工場台帳は工場着金/開始なしに製造へ進めない。新QC対象は未承認/出荷前残金未着金で発送不可。新製造台帳を始めた案件は配送計画未登録でも全数量の実発送、顧客実受領と納品書/送付受付なしに完了不可。旧未記録事実はbackfillしない。

## 総残表（合格済みの代表通しと全機能完成を区別）

| 優先 | 未完・外部確認 | 現在の安全条件/次の受入 |
|---|---|---|
| 公開前 | 最新provider backup認証/Restore点と書込差分 | 第2/3承認済でも本番変更は待機。実データexport/新課金なし |
| 公開前 | サンプル/第4〜9の新権限 | 上記範囲を具体承認後、tested migrationと同SHAを公開 |
| 公開前/運用 | 船/air×食品の正式海源中国宛先対応表、担当物流の本人所属 | 推測自動割当しない。固定版作成時の出典確認必須 |
| ローカル合格 | 顧客の半金・後払契約と条件別請求/発注gate | 第8段で固定見積条件→顧客承認→請求継承。全額/半金/後払、発注前と発送前の独立額、未収保持。SQL10件、対象19件、実DB4ケースPASS。分割請求・顧客固有カスタム比率は未追加 |
| ローカル合格 | 工場の分割完工QC | 第9段の累計40→100承認、承認容量の配送/倉庫共用・実同時割当・20/20/60分納・部分受領・3便納品書を確認。全体影響不承認は発送停止。発送済み品の回収/返品は未実装 |
| 当初必須 | 自動最新FX/RMB・確定した料金表 | 手入力FXの出典確認のみ、fallbackなし。未確認料率を正本扱いしない |
| 運用必須 | 誤記訂正/返金/支払取消/合意条件改訂/銀行差替え | 不変履歴を削除して訂正しない。実送金なし、専用追記訂正設計が必要 |
| 合格済/継続確認 | 検証エラー後の入力訂正と要求ID復帰 | 顧客精算/工場製造/QC/配送の確定SQL拒否＋本人台帳の未保存確認だけ解除。保存済み・読取失敗・transport不明は維持。対象15件と実DBの未来日時拒否→同画面訂正→通し完了PASS。QCアップロード前検証や旧フォームの個別訂正は引き続き確認対象。送信予約は解除しない |
| 運用必須 | 同版メール再送・リンク期限延長 | 不明結果は永久再送停止。第4段本人ポータルで閲覧は継続。確認済み再送/再発行の新管理は未実装 |
| 運用必須 | 固定配送版の発送前訂正/取消、配達未受領の争議台帳、追跡番号途中変更 | 現版は不変、実数受領と連絡で安全に停止。分便/部分受領は対応するが全訂正業務は未完 |
| 外部連携 | carrier追跡API、FAINS/検査機関、実メール到達 | 手動 source/time と未連携表示。ローカルMailpit合格は本番接続/到達の保証なし |
| 外部/旧データ | 旧未紐付け採用6件 | 勝手な紐付け/破壊なし。正本に基づく手動整理、閲覧/旧PDFを保持 |
| 残置 | DB current_date UTCとJST業務日境界 | 時刻付き輸送は端末現地→UTC保存。金融/製造の業務日TZ統一は未完 |
| 後回し | 新倉庫保管・月次請求の拡張 | 既存倉庫/保管請求は保持、新中国輸出とBAO倉庫入庫を混同しない |

履歴を書いた後のrollbackは新規操作停止＋互換読取維持のforward fix。backup復元はbackup後の実取引書込を失うため利用停止/差分判断が先。新台帳DROP・旧6件delete・実データ無承認copyを復旧手順にしない。

最終追加確認：新製造台帳の案件は発送計画をまだ作っていなくても、直接shipped/deliveredへの変更を拒否する。発送計画は製造中だけ作成可能。旧製造台帳のない案件の過去履歴を補完しない。

## 台帳構成の重複レビュー

既存documentsは社内の発行帳票、client_document_packetsは顧客へ渡す承認対象の固定公開版、shipment_delivery_documentsは実受領に基づく便単位の納品書であり、同じ状態の二重更新ではない。既存inbound_shipmentsはBAO倉庫入庫、shipment_plans/milestonesは中国輸出から顧客配送であり分離を維持する。sample_costsは量産原価に混ぜず、請求lineと関連付けて二重請求を防ぐ。工場送金申告と工場着金確認、顧客申告と営業実着金、物流配達と顧客受領は、確認者・権限・時点が違う独立証拠である。

各領域のrequestsは役割別RLSで保存復帰する冪等台帳、mail_receiptsは外部POSTの永久予約台帳で、取引テーブルに統合すると公開範囲や外部結果不明の扱いを混ぜる。専用RPCの同一トランザクション内で業務記録と要求結果を確定する。外部メールはDBとatomicにはできないため、予約→一度のPOST→結果追記に分ける。31表を減らすための既存履歴移行・共通台帳への大改造は今回行わない。表数だけで完成度を判断せず、実業務上の訂正・半金・分割QCの残りを優先する。

## 第8段の追加権限差分（本番未承認・未適用）

新tableなし、31表のまま。snapshotに固定顧客支払条件を加え、営業管理者専用のpreview_client_document_with_terms(uuid,uuid,text,text)をauthenticatedへ公開（匿名不可・内部staff判定）。既存client_finance_commandの顧客自社回答/入金申告・営業実着金の範囲は維持。金額計算/threshold helperは一般role実行不可。既存paid工程/正式POの全額gateを、顧客が承認した必要前払額へ変更し、顧客発送前残金gateをshipment_plans/milestonesへ追加する。工場/QC/物流/顧客の操作範囲とStorage scope/TTLは拡大しない。

業務影響：半金着金後・承認済み後払いは正式POへ進めるが、未収請求は消えない。発送前残金条件なら未着金の輸送計画/イベントを止める。paidの表示は「支払条件確認済み」とし、全額実着金とは呼ばない。旧条件なしsnapshotは全額前払を維持。新RPC依存UIとmigrationの同版公開が必要。半金/後払開始後に旧UIだけへ戻すと全額請求gateへ倒れるため、互換viewerを維持するforward fixが必要。詳細はCODEX_CLIENT_PAYMENT_CONDITIONS_STAGE8_RELEASE_GATE.md。

## 第9段の追加差分（本番未承認・未適用）

新tableなし。factory_qc_reviews.rejection_scope列を追加（all既定 / new_quantity）。既存factory_qc_commandの自社工場累計提出/営業管理者QC判断だけで記録する。新caller/token/Storage権限は追加しない。QC数量/配送倉庫予約helper/triggerは一般role実行不可。既存shipment_contextは営業/工場の自社QC数量、営業の割当残量だけを追加投影し、物流/顧客にはnull。PRIVATE QC画像の読取scope/60秒署名、顧客帳票7日リンクとログイン必須を維持。

業務影響：一部承認数量だけを発送/入庫へ割当可能になる。別便と倉庫の二重割当、取消後の容量超過再有効化を停止。後続QCの不承認は既定で既承認分も止める。営業が追加分だけの影響で既承認分は問題なしと確認した場合だけ前承認数量を維持。既存履歴は変更しない。旧全量提出は累計全量のまま互換、新製造台帳なし案件の推測補完なし。分割数量開始後の旧UIだけの切戻しは避け、互換閲覧＋forward fix。公開全体は第2/3既承認、サンプル8＋第4〜7計23表の新権限、private QC、そして第8/9の既存gate変更を同時に審査する。

## Stage10（追加表なし・本番未適用）
営業/管理者の訂正版preview、同請求reissue、期限切れlink更新、明示依頼の同版再送、銀行実施済み返金記録。新RPCは認証＋staff限定、匿名/顧客/工場/物流拒否。顧客は既存自社packet RLSの範囲で旧版/取消版をreadonly閲覧・状態付きPDF取得。内部payment family/totalsは一般ロールのEXECUTE剥奪。返金/再送の事実は既存request履歴に追記、31表の既存role範囲を広げない。Stage10 release gateとrollback注意参照。着金済みの金額変更/相殺は別扱いで未実装。

## Stage11（表数・既存role範囲は不変）
新RPC preview_client_price_reissueだけを追加（authenticated EXECUTE＋内部営業/管理者必須、PUBLIC/anon不可）。既存finance commandで発注前の再価格提示/顧客の新価格と着金配賦再承認/請求差替を追加。自社顧客のrespond_quoteに引継ぎ確認を保存。工場/物流/他社には追加操作なし。既存staff summaryの読取項目とclient contextのcurrent_priceを追加。新表0、既存31表のGRANT/RLS/Storage追加0。新migrationと新業務操作の審査/適用は未承認のまま。発送済み/発注済みの再契約・実返金送金は行わない。

## Stage12（未公開）
case_chat_reads新1表で未公開台帳32表。既存chat_rooms/messagesの広いpolicyとPUBLIC継承direct writeを閉じ、営業管理者/実顧客・工場・割当物流だけの会話。legacy peer欠損室はstaffのみ。新業務RPC7＋RLS helper1、内部helper2は一般EXECUTEなし。自社sample請求PDF読取は固定宛先RPCだけ。既存pricing RPC/CNY費目で新価格版換算、原価の外部読取拡張なし。Storage/credential/default ACLのStage12追加0。旧非公開archiveのdirect chat writeは新RPCへの配線が必要。詳細とrollforwardはCODEX_CHAT_SAMPLE_FX_STAGE12_RELEASE_GATE.md。
