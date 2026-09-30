# 038〜047 公開前read-only審査

2026-09-30 09:38 UTC。判定は**本番適用・公開を保留**。認証済み読み取りは完了したが、既存6案件の仕様移行、Storage権限、バックアップ復元・隔離ステージングの確認が残る。migration適用、業務データ修正、メール送信、Storage書込、push/deployは実行していない。

**後続のローカル修正**：[048〜050追加・合成fixture検証・手動対応一覧と新しい承認対象](CODEX_RELEASE_FOLLOWUP_048_050.md)。以下は09:38 UTC時点の審査記録。後続で実データコピーの不要性と、未登録回答/メール/権限の候補を検証したが、本番適用・公開は保留を継続する。

## 対象と証拠

- DBはTokyoの`baoflow-v2` / `uocpewtmhmdfhdvnrljl`、Postgres 17.6。取得時のactorは`postgres`、BYPASSRLS=true。権限不足の迂回は行っていない。
- 適用履歴30行、最新は`20260926064840 / 037_deal_wizard_catalog`。038〜047の履歴・新表/新列/新trigger衝突は0。履歴番号はtimestamp方式なので、ローカル038等とname/SQLを対応付ける必要がある。001/010再適用、旧DB031混入、CLIの全履歴一括pushは禁止。
- Vercel `baoflow`のproduction deploymentは`dpl_8kv6JeHGQB9kVWtArojx8QAmxHpk` / READY、commit `363229a45fe5b56966563306deda2919a66809c3`。今回の候補コードは`05e61f9`で本番未反映。
- [集計・schema/RLS/trigger/関数hashの証拠](../artifacts/release-audit-038-047.json)。顧客名、業務record ID、メールアドレス、token、フォームpayload、secret、Storage実体は取得していない。これはバックアップではない。

## preflightの精査と実行範囲

`scripts/preflight-release-038-047.sql`の34検査は全てSELECT。外側はREAD ONLY transaction、statement timeout 30秒、lock timeout 2秒、最後rollback。DDL/DML、権限変更、外部呼出し、OS/ファイル読取、ロック取得用更新を含まない。動的SQLは固定の検査文だけで、結果は名前・重要度・件数・欠落column件数・SQLSTATEだけ。SQLERRMや行の値は表示しない。

connectorは最後のSELECTの結果行を返し、DOのNOTICEを検査結果として確実に回収できないため、既存columnをcatalogで確認してから同じSELECT本体29件をREAD ONLY / timeout 20秒 / rollbackのUNIONで取得した。新表等のない5件は未適用として記録し、0件成功扱いしない。別途Storage/料金/legacy紐付け/衝突/grantを集計した。新表RLS検査の0やpolicy名だけの検査は、不在・policy式の正しさを証明しない。

## 既存データの結果と適用時影響

| 項目 | 件数・結果 | 判断 |
|---|---|---|
| 037必須column欠落、対象表RLS無効、単純な全authenticated許可policy | 各0 | schemaの基本前提あり。関数/enum/trigger/権限定義も別途確認 |
| 負在庫、台帳残数不一致、案件/顧客の入庫・出荷不一致 | 各0 | 取得時の整合性。実writeロール試験の代替ではない |
| variantのない採用見積 | 6見積 / 6非archive案件 | **移行判断が必要**。全6件はspec_idも商品階層もない。工場紐付けあり。製作以降の案件は0 |
| 存在するvariantの案件違い、採用数量/価格/為替異常、同scope複数採用 | 各0 | 不明な6件を現在仕様へ自動推測して紐付けない |
| 旧帳票snapshotなし | 1 | 当時内容を現在値から復元できない。原本を別途保全し、現在値の参考表示と区別する |
| 帳票番号の歴史的重複group | 0 | 041/046は既存番号を維持し、新規番号のみ保護 |
| RFQ、RFQ回答フォーム、未登録工場招待 | 全て0 | 今回は旧RFQ再発行対象なし。一般に045適用でsnapshotのない未回答旧リンクは拒否される |
| deal_fees、正の見積検査費、検査費二重計上候補、費用重複group | 全て0 | 既存の重複はない。将来の費用ルールが正しいことは未証明 |
| 未完了入庫 / 未完了出荷 | 各1 | 044の新状態trigger影響をステージングで確認し、切替中の操作を止める |
| 新RPC、復帰SELECT policy、発注/要求台帳 | 未適用 | コード単独公開不可。適用後に存在・grant・RLS式を再確認 |

038は台帳UPDATE/DELETEをauthenticatedから撤回し、補償取引へ切り替える。039/040は状態・採用と履歴を原子的に保存する。041/046/047は採番・発行を安全化し、047は採用見積の最新集合/金額をDBで照合する。042/043は要求台帳とretry、044は工場発注snapshotと製作開始gate、物流の承認/取消制限を追加する。045は依頼当時の仕様数量を必須にし、登録済み工場の回答を数量別見積へ保存する。

DDL適用だけでは既存6件を商品仕様へ移行しない。040/047はlegacy採用見積を扱えても、044の新工場発注にはvariantが必須となり、発注なしの新しい製作開始が止まる。仕様確認なしのダミーvariant作成・新発注snapshotの捏造を解決策にしない。

## 実用完成に追加すべき作業

| 対象 | 確認済みの仕組み・不足 | ローカル修正か外部確認か |
|---|---|---|
| 既存6案件 | 商品/仕様がないため044へ進めない | 業務担当が私的な管理画面で仕様を確認。ローカルに検証可能な移行/legacy制限案を準備し、対象列・履歴・原金額不変を明示してからDB変更の別承認 |
| 未登録工場pending回答 | APIは招待と回答を保存するが、factory_idなしでは見積を作らない。登録後の同payload再送もreplayedになり取り込みを行わない | **ローカル機能追加が必要**。営業限定の招待→登録済み工場照合→明示取り込みを原子的/冪等に実装し、回答snapshot・依頼数量・全仕様・所有案件を再検証。単にfactory_id更新や再送を促すだけでは完成しない。登録済み工場限定で公開するなら制限を明記 |
| 費用 | 見積原価に検査費を含め、帳票はdeal_feesを別途加算。現在0件 | 検査費/型代を原価込み・別途請求のどちらにするか業務決定。必要に応じローカルに費用source/計上区分と二重計上guard、発行時fee集合/金額照合を追加。旧spec fee保存はdelete→insertの非原子経路なので、復活させるなら同時にtransaction化 |
| メール | 明示送信、HTML escape、期限/リンク確認、provider idempotency keyあり。未設定時は送信失敗を表示しリンク共有は可能 | Vercel connectorはenv名・値を提供しないため、`RESEND_API_KEY` / `RFQ_MAIL_FROM` / `NEXT_PUBLIC_APP_URL`のproduction/preview配置、送信元domain認証、providerの利用範囲を未確認。CLIなし。秘密の探索/迂回はしていない。管理者による設定の存在確認と、専用テスト宛先1通の承認が必要 |
| メール再試行 | provider成功後にDB履歴保存が失敗すると送信済み印がない。現在provider message IDを保存しない | Resendの冪等keyは24時間。長時間後の二重送信を防ぐにはローカルに送信要求/不明状態・provider ID照合/手動確認を追加。keyだけで永久に重複しないとは説明しない。[公式仕様](https://resend.com/docs/dashboard/emails/idempotency-keys) |
| Storage | deal-imagesあり、public=true、50MiB、MIME制限なし。アプリguard/失敗cleanupはモックPASS。DB policyはINSERT/DELETEがbucket一致だけで全authenticatedを許可 | **DB policy修正候補が必要**。営業/管理者と案件path検証をDB側にも適用し、別顧客/工場/匿名の直接API拒否を隔離環境で試験。既存policy変更は未承認。private化する場合はsigned URL対応・既存public URL移行をローカル準備し、破壊影響を確認して別承認 |

public bucketはURLを知る利用者が取得可能であり、public SELECT policyを変えるだけではprivateにならない。[Supabase公式](https://supabase.com/docs/guides/storage/buckets/fundamentals)。Storage実体は読んでおらず、機密内容の有無は判断していない。実upload/delete試験は専用合成file・専用path・テストactorを承認後に用い、本番既存fileを試験に使わない。

権限の追加審査事項：既存主要10表それぞれにanon/authenticatedのTRUNCATE grantがある。通常のREST CRUDでTRUNCATEできることは確認していないが、TRUNCATEはRLS対象外なのでgrantの不要性を審査し、不要なら明示revoke候補とする。[PostgreSQL公式](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)。038のUPDATE/DELETE撤回だけではこのgrantは残る。新表もSupabase既定grantを継承し得るので、適用後の全grant検査が必要。042のowner書込可能な要求台帳は直接API経由で本人が結果を変更できる設計であり、監査不変性が必要ならprivilegeとRPC方式を別途見直す（invokerの書込grantだけを撤回するとRPC自体も壊れる）。

## backup・rollforward・rollbackの具体策（当初審査時点）

2026-09-30追記：公開/push/必要merge/deploy/通常schema migrationは承認済み。専用localhostで合成dataの実Auth/Storage/Mailpitおよびbackup復元PASS。全53表と両creator ACLを再読取済み。以下は当初の未承認状況を含む履歴であり、現在の承認範囲・個別権限変更・本番backup gateは[最新追補](CODEX_RELEASE_FOLLOWUP_048_050.md)を参照。本番反映はまだ行っていない。

1. 業務担当が6案件の移行方法と費用/公開file方針を決める。別DBの既存隔離ステージングの識別子、データ保管先・権限・削除期限を承認する。新有料project/branchは作らない。
2. 本番書込停止時間を定め、切替直前のtransaction一貫backupを許可された暗号化保管先へ作成する。public schema・enum・constraint/index/trigger・関数定義/owner/search_path/execute grant・表grant/RLS/policy・migration全履歴とSQL・sequence、業務dataを含める。Auth/Storage設定とStorage objectsのmetadata/実体も必要範囲を保全する。backup世代時刻・checksum・restore手順を記録する。今回取得した集計/hashはbackupではない。
3. 対象backupを隔離環境へ復元し、復元前後の行数/在庫台帳/帳票・番号を照合する。DB backupだけではStorage実体を復元できない。[Supabase公式](https://supabase.com/docs/guides/platform/backups)。通知/provider接続を無効にし、外部宛メールや実顧客操作を防ぐ。
4. 候補commitと各SQL hashを固定。既存履歴とtimestampの対応を承認し、038→047を順番に**隔離環境だけ**適用する。段階ごとに適用履歴・grant/RLS/trigger・新表・preflightを確認する。044はCREATE TABLE/trigger/columnに再実行非対応箇所があるため、失敗後に全ファイルを盲目的に再適用しない。
5. 6案件の承認済み移行案、旧帳票1件の参考表示、未完了入出庫各1件、直接APIのロール拒否、RPC競合、Storage権限、費用をfocused検証する。mailは別のテスト送信承認で検証する。合格後、初めて本番backup/migration/コード公開の具体的計画を承認対象にする。
6. 本番適用時はwrite停止・backup確認・対象履歴再照合後に最小migrationだけ適用し、役割別smokeと集計を確認してから対応コードを公開する。codeだけ先行しない。適用中は旧writerからの状態変更/採番/台帳訂正を停止する。
7. 障害時は影響操作（採番/発行/発注/検収/出荷/外部回答）を停止し、migrationのどこまでcommitしたか確認。既存definition/grantと照合した限定rollforward修正を優先する。丸ごと逆migration、全grant復活、旧アプリだけの再公開は安全なrollbackではない。
8. issued documents/要求台帳/counter/発注snapshot/在庫台帳を保持する。修正は補償取引で行い、番号を再利用しない。旧定義へ戻す必要がある場合はbackupの正確な関数/trigger/policy/grantを復元し、その旧動作の許可範囲とデータ適合を再試験する。UI旧版に戻す際も発行等を無効にする。全DB restoreは適用後取引を失うため、別の停止時間・喪失範囲・復元承認を必要とする。

## 次の承認を分ける

最初に必要なのは**隔離ステージングの準備/復元/038〜047適用試験**。対象DB、保管先、既存dataをコピーする範囲と保持期限を指定する。リスクは機密dataの複製・隔離環境でのDDL変更・資源利用。実本番適用やdeployは含めない。今回の読取権限には不足がないが、env設定の確認手段は提供されていない。

別承認：本番6案件の仕様紐付け/履歴変更、Storage/grant変更、本番backup/migration、GitHub push/PR/deploy、送信元設定変更とテストメール、専用pathへのStorage write試験。それぞれ候補の対象・SQL/コード・検証・影響を先に確定する。新課金/アクセス作成や実顧客メールはこの承認に含めない。

## 審査対象SQLのSHA-256

| SQL | SHA-256 |
|---|---|
| 038 | 24de3f401ddc8770f91297e090b8dc44003f8d1e34886b338d3626b528f4d85d |
| 039 | 9994f2051ebf55dae1d9419ec31c312c062d1b01467a369a2fbf3284190d1bf2 |
| 040 | b6f77cc7383e03bdb8b5795ee4b4386bec6166343dd4d040bfd1c97a36702cdc |
| 041 | 339589e38198b39ee3c6d0848e5f3ee95c667aa7adc035cc38281ef521278fca |
| 042 | a78e01beec4f0c9c2048e9c13b326e9f17a2cb25f41281266aa03307dbd1cac5 |
| 043 | 004a3c2eb5590650b3952a570ed3dc5efcd748f67acd993a039600d615dc591d |
| 044 | 7998112f21299f70a6f3825bccad5211aa06c2b4aac11deddd4bbf031e55e359 |
| 045 | 443f1fd823b530127a35a5a6dc5ab158c81f3012db4bf8ca850041cc60ad782f |
| 046 | 149490cbad2d426eb668820b147a842109aa2fe7128b393a47a4ec6458ac91fb |
| 047 | 6eef45c0e3b8c9a2c837aa9435a3133ea8fe331722b56f0eeb9cbf681d7114ac |
