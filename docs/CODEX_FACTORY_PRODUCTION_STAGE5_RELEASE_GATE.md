# 第5段：工場最終条件・支払記録・製造開始

ローカル候補 `20261001130755_factory_production_v1.sql`。本番未適用。銀行への送金・外部メール・新credential生成なし。

## 実装

営業 `/deals/:id/production?order=:orderId` と工場 `/factory/orders/:id`。既存immutable正式POを入口に、工場の最終条件版→営業の登録銀行原文照合/条件同意→営業の実際の手動送金記録→工場の自社銀行着金確認→工場の実際の製造開始を独立記録する。営業は工場の着金/開始を代行できない。

全額前払/一部前払/納品後払と残金期限を明示する。後払は前払0の明示と営業同意が必要。最終額はUSDのPO数量×保存単価と一致必須。費用差・別通貨・不明銀行を推測して補完しない。変更額は新採用見積/発注へ戻す。登録銀行原文はfactories.bank_info.rawと登録元/更新日時をsnapshot保存、営業照合根拠は工場へ非公開。登録情報変更後は新送金記録を停止し再確認する。

営業の送金記録で製造開始を解除せず、工場確認済み着金が合意前払額以上の場合に工場が開始を記録する。製造期間は暦日、完了予定は開始日＋合意日数。全有効POの開始が揃い、案件の入稿確認済み状態からのみ営業が製造工程へ明示反映。旧案件/旧POの未記録事実をバックフィルしない。

同UUIDの再試行は本人/対象/同payloadのみ復帰。全表immutable、送金証跡unique、着金番号はorder内unique、過剰送金/過剰着金拒否。既存第4段の金融共有履歴がある案件の新規正式POは、現在の自社invoice・採用行・全額実着金が必要。未確認申告では発注できない。

画面は担当工場/次操作/完了予定/顧客希望納期を表示し、原文と履歴を折畳む。未確認送金がない場合に空の着金入力欄を出さず、不要な再入力を減らす。新しい発注IDが別案件の場合は最初の注文へ勝手にfallbackしない。

## 検証

対象SQL6件PASS：前払/後払、原文・古い版・PO金額差、staff/factory操作区別、他工場/顧客/物流/anon、直接write/TRUNCATE、immutability、遅延DB失敗のrollback、手動状態更新のbypass防止、第4段金融ケースの新PO gate。

localhost実Auth/PostgRESTのsales/factory/foreign/client/logisticsで対象1通しPASS：正式PO→実画面で条件提示/銀行照合/送金記録/工場着金/製造開始/営業工程反映。前払着金前の開始button disabled、20暦日で2026-10-21、390px横溢れなし、他role拒否、工場には営業の内部銀行照合記録を返さない。新機能のみ対象とし重い全suiteは再実行しない。lint/typecheck/buildを確認。第4段native testのhelper名とDOM document名の衝突も修正し、testを含むtypecheckを確認した。

画面証拠 `artifacts/factory-production-stage5/` は合成のみ。Library ID/人間の理解時間/操作削減数は未取得。

## 本番追加権限案（sample/第4〜7段とまとめて審査、まだ適用しない）

新6表 factory_final_terms / factory_terms_agreements / factory_transfer_reports / factory_bank_acknowledgments / factory_production_starts / factory_workflow_requests。

- 営業/管理者：6表SELECT（requestは本人）、RPCで条件同意・手動送金実施の記録・全工場の開始確認後の工程反映。
- 工場：自社注文の条件/送金/着金/製造開始をSELECT、自分の工場操作requestのみSELECT。内部agreement表はSELECT不可、contextでは同意版ID/時刻だけ。RPCで自社条件の提示、自社銀行の着金確認、実際の製造開始だけwrite可能。
- 顧客/物流/匿名：新表・銀行情報・RPC利用不可。authenticated EXECUTEでも実行時role/order.factory_idを照合。匿名/PUBLIC EXECUTEなし、直接write/TRUNCATEなし。
- 既存PO/deals：新金融案件の正式PO gate、新工場台帳を始めた案件の製造開始guardを追加。旧運用の注文閲覧は残す。
- 既存factories.bank_infoは読み取り固定版に使うだけで書込権限を増やさない。Auth/Storage/default ACL変更なし。

## 残る範囲・復旧

次の第6段に完成証跡（全体写真/梱包写真/動画）、BAO QC承認、残金と出荷gateを追加する。まだQC/出荷まで完成したとは扱わない。合意済み条件の訂正、送金取消/返金/銀行差替え、USD以外の手数料/FXは推測実装しない。日付のfuture guardは現在DBのUTC current_dateで、業務TZの境界は公開前に整理する。

backup復元点と第5段の新権限は本番待ち。新記録がある場合、rollbackは新規操作停止・immutable履歴/互換viewer維持のforward fix。table DROPや実支払記録deleteで戻さない。第4段残（後払/半金顧客条件、返金、同版再送/期限延長）は総受入リストで保持する。
