# 第3段 価格改訂・費目・手入力FX

最新状態：第3段の具体権限は親の確認で承認済み、現行backup認証/復元点待ち。本番未適用。第2段 e9ec145 と別差分。対象migration `20261001102446_quote_pricing_revision_v2.sql`。第2段承認はこの追加権限を含まない。

## 業務契約

売価＝原価÷掛率（原価率）。粗利率や原価倍率ではない。掛率入力と税抜円単価入力を切替え、数量×単価と税抜/税込総額をDBで確認して、新しい未採用版を保存する。旧価格・採用・PDFは変更しない。各費目はこの数量の総額、通貨USD/JPY。版代/色指定費/国内送料/国際送料/その他費用を各1行明示確認し、不明は空欄で保存停止、確認した0のみ許可。追加費目は名称・通貨・額を台帳に保存。円換算後の明細は売単価へ含み、帳票で再加算しない。

サンプル名・追加版代をcustom行へ入れる操作を拒否する。サンプル旧保存値を量産新版へ移さず、別round手配/後日まとめ請求へ分離する。そのサンプル独立台帳の実装自体は後続であり、今回完成としない。RMB自動換算、海源未確定料金/税/DDP/有効日/輸送日数は未実装・要確認。

FXは手入力確認のみ。rate/reference/as_of（タイムゾーン必須）を価格snapshotに固定。最新provider自動取得とは表示しない。見積書発行時も全採用版と同じrateを入力確認し、確認日時と自動取得falseを発行snapshotに保存。rate変更は新価格版とPDF再確認が必要。新帳票はversionを増やし、旧PDFの再出力は同じ保存内容。旧別途費用が残る案件は配賦確認まで新価格版の帳票発行を拒否し、推測移行/削除しない。

## 本番で追加承認が必要な対象

- deal_quotes.pricing_snapshot jsonb列：既存staff限定の価格読取範囲へ凍結費目/手入力FX/元版参照を追加。他role読取は増やさない。
- quote_cost_lines新表：authenticated SELECTのみ・staff RLS。INSERT/UPDATE/DELETE/TRUNCATEを付与しない。営業/管理者専用RPCで新しい版の明細を一括作成する。
- quote_pricing_requests新表：authenticated SELECTのみ・本人staff RLS。直接書込/TRUNCATEなし。UUID/hashを使った再試行と本人結果復帰用。
- preview_quote_pricing_v2(uuid,jsonb)、save_quote_pricing_v2(uuid,uuid,jsonb,jsonb)：新authenticated EXECUTE、内部営業/管理者限定。anon/PUBLIC拒否。固定search_path。別案件・未紐付け・archive・欠損・重複費目・確認前変更を拒否。
- keep_quote_pricing_snapshot trigger：新価格版はstatus/updated_at以外の更新と削除を拒否。旧価格版は対象外。修正は新価格版、採用/解除は既存処理。
- issue_document_atomic同名関数更新：既存staff scope/EXECUTE/本人retry/採番を維持。新価格版の手入力FX確認と同rate/完全snapshot・旧別途費用の未配賦を検証。versionを新発行ごとに増加。
- keep_priced_document_snapshot trigger：新価格snapshotを含む発行済みdocumentsの直接更新/削除を拒否。旧snapshot無し帳票は変更しない。訂正は新発行版として残す。

新Auth/Storage/公開読取/default ACL変更なし。旧6件の補完・既存行backfill・本番export・外部テストメールなし。

## 復旧と公開順序

第2段はe9ec145だけを対象にし、第3段の新列読取コードを混ぜない。第3段はこのmigrationを適用してから対応appを公開する。既存data互換と復元点を確認し、追加権限は具体承認後に適用する。

障害時は新価格改訂/新発行を停止し、既存の新版/費目/要求台帳/発行snapshotを残す。旧APIから凍結版を書換える回避はしない。FX確認を持たない旧アプリへ戻す場合、新価格版の見積書発行は停止状態になるので互換画面を残して修正する。保存記録のDROP/台帳リセットは復旧手順にしない。

## 検証記録

pure+PGlite 8件：双方向/丸め/欠損/0円確認/負数/重複/サンプル分離、競合0保存、後半DB失敗全取消、旧版保持、永久UUIDretry、価格更新/削除拒否、role/grant/TRUNCATE、発行FX確認/版本増加/旧snapshot保持/未配賦拒否。

合成browser：価格プレビュー→編集で確認解除→保存失敗→同一依頼retry→新価格版表示、既存代表業務。実画面で表のwhitespace継承によるmobile横溢れを修正し、dialogの横溢れなし・保存CTA画面内を確認する。応答喪失後reloadの同一版復帰とUUID/SHAのみ保存も検証する。

実localhost Auth/PostgREST/Postgres/browser1件：手入力FX・新価格/費目保存・採用・確認付き見積書から請求/発注/入庫/Storage/保管請求PDF Mailpit/顧客役割拒否/出庫/納品まで合格。実enum draftingと帳票ページsnapshot読取不足をこの検証で修正。

実localhostの新RPC/費目台帳ロール試験も合格：sales/admin preview可、client/factory/logistics preview/save/費目読取拒否、全authenticated直接費目INSERT拒否、anon EXECUTE拒否。作成した試験ユーザーを削除。

広いソース123件/失敗0、SQL確認3スクリプト、価格/比較/代表/帳票ブラウザ12件合格。その後は価格SQL8件と価格編集browserを変更箇所に絞って再確認。lint/typecheck/buildは最終UI差分まで直列確認する。本番への実メール・試験取引は実行していない。

最終の価格editor browser2件、SQL8件、lint/typecheck/build合格。新価格と発行済み帳票の直接更新拒否も実localhostで確認し、試行は取消済み。専用container/volumeは停止・削除、残存0を確認。新画像pricing-confirm-390.pngを目視確認し、横溢れなし・確認金額/保存CTAが画面内。ID/SHAのみの再読込復帰を確認、秘密/フォーム値を永続保存しない。

## 第2段公開の現在ゲート

第2段DB変更・公開はユーザー承認済み。ローカル公開branch codex/rfq-stage2-releaseはe9ec145を指す（第3段を含まない）。2026-10-01 10:42 UTCの本番read-only確認ではACTIVE_HEALTHY、migration052まで、RFQ0/v2forms0/mail receipts0/旧未紐付け採用6件。実remote mainはf5ae386で変化なし。

この環境のツールには既存Macブラウザ操作がなく、agent-browser未設置・既存Chrome CDP待受なし。最新provider backupを再読取できないため本番適用/push/merge/deployを停止。親側で本番uocpewtmhmdfhdvnrljlの最新成功PHYSICAL backup日時とRestore可否（またはPITR範囲）を確認して伝達する必要がある。復元実行、新認証情報、本番exportは不要・実施しない。過去の9/29 backup確認を現在の復元点とは扱わない。
