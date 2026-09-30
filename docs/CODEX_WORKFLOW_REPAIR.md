# BAO Flow 実務フロー修正とリリース判断

2026年9月30日 07時51分 UTC。代表案件を実ローカルSupabaseの認証・RLS・PostgRESTとブラウザから納品まで完走した。ローカル実装は完了、本番反映は未実行。代表経路の成功と全機能の保証は区別する。

## 作業場所と接続先

作業場所は `/Users/bingbai/Documents/Codex/2026-09-30/task/baoflow-improvements`、ブランチは `codex/workflow-ux-repair`。基点は [GitHub main](https://github.com/bingbai-ux/baoflow/commit/363229a45fe5b56966563306deda2919a66809c3)。完了時の読み取りでも main と Claude ブランチの両方がこのSHAだった。

元の `/Users/bingbai/Desktop/アプリ開発/baoflow` は HEAD `40dad963c1536b232ba4ae1e74057ee2334354bd`、未追跡 `BAO-PMS仕様書共有.zip` のまま保全。独自RLS変更や旧DB用031を最新版へ移植していない。Claudeセッションの停止自体は未確認。

[Vercel本番](https://baoflow.vercel.app) は基点SHAの READY deployment `dpl_8kv6JeHGQB9kVWtArojx8QAmxHpk`。公開JSのURLから新DB `uocpewtmhmdfhdvnrljl` を確認。認証済みメタデータ読み取りで新DBはTokyoのbaoflow-v2、037までのmigrationを確認した。プレビュー `dpl_3UMpfANMPEezoZy6wqZVksHGcfhG` も同じSHAだが接続DBは確認できなかった。旧ローカルは `dbnjrvpzmxzrkrzrynio`。旧DBにはローカルにない履歴もあり、現在の安全な開発基点には使わない。

環境ファイル・秘密値・実顧客データをコピーしていない。ブラウザ検証は localhost の架空データのみ。fixtureのダミー認証に加え、専用Supabaseで使い捨て実Authユーザーを利用した。

## 優先順位と受入条件

1. P0 在庫：不足・負数・小数・別顧客・未承認を拒否し、途中失敗で全件rollback、再試行で二重入庫/出荷しない。
2. P0 金額・帳票：MOQ/数量/為替/掛率を検証、採用見積だけを請求、採用と履歴を一括保存、過去帳票を当時の金額で再印刷する。
3. P1 状態・権限：営業操作をサーバーで確認、更新と履歴を一括保存、古い画面の状態上書きを検知、未納品の完了アーカイブを拒否する。
4. P1 UX：次の作業へ直接移動、工場回答の不足を具体的に表示、案件作成の失敗/一部保存を伝える、請求書ボタンを実装、空状態と障害を区別、スマートフォンで操作できる。

## 修正した内容

- 038：入庫確定・出荷依頼作成・出荷実行をRLSを尊重するRPCに統合。親/在庫行をロック、複数明細の合算、承認・所有権・残数を再検査。台帳変更/削除を制限し、訂正は補償処理にする。
- 039：簡易ステータスと既存master_status必須列を持つ履歴を一括保存。古い状態からの更新を拒否。完了アーカイブは納品後のみ。
- 040：見積採用を同じ商品群で排他的に保存。MOQ/価格/為替/掛率/アーカイブ/ロールを再検査。検品費の人民元分を計算に含め、カートン変更時の既存見積再計算を接続。
- 041：帳票採番をロック付きカウンタへ変更。既存重複番号を削除せず、4桁番号にも対応。発行内容のスナップショットを保存して再表示。未採用見積へ暗黙フォールバックしない。
- F&Cの色・字体を維持し、次の作業の深いリンク、入力ラベル、モバイルナビ、操作領域、読込・障害・再読込を改善。
- パスワード復旧callbackの認証遮断と外部next転送を修正。未知プロフィールを営業権限へ昇格させない。
- 請求書作成ボタンを請求書モーダルへ接続。モーダルをbodyへ配置し、印刷時は操作バー/背景アプリを除去。

## 追加修正と具体的なUX

- 042：案件・仕様・数量・履歴を一括transaction化。画面が保持するrequest UUIDで再試行を同一結果へ戻し、異なるpayload/他actorの再利用を拒否。
- 043/045：RFQ・招待・外部フォーム・台帳を一括保存。依頼当時の仕様/数量を固定し、工場回答を数量別見積へ接続。全仕様の回答を要求し、一部失敗は全rollback。工場ごとの梱包条件を独立保存。回答単価から原価/売価を計算できる。
- 044：採用見積から工場発注の不変snapshotを作成し、その数量・仕様から入庫予定を作成。工場には自工場の原価だけを公開。分割入庫上限とretryを検査し、物流による営業承認・キャンセルを拒否。
- 046/047：旧重複番号は保持し、新たな番号重複を拒否。採番・発行snapshot・台帳を同transactionにし、途中失敗で番号もrollback。同じ発行のretryは同一書類を返す。独立レビューで見つかった採用見積ID重複による二重計上を拒否し、実DBのID集合と明細単価も照合する。
- 案件上部：工程、返事待ち、希望納期、担当をまとめ、原価/売価/数量は既存Cool Blue面で表示。従来は個別欄を探す必要があった。
- 待ち先：クリックの循環変更を明示選択へ変更。工程帯は選択中の工程へ自動スクロールし、幅390pxでも次の操作を確認できる。
- 工場発注/入庫：別画面で仕様を転記する操作を、案件内の採用見積→工場発注→同仕様入庫予定ボタンへ接続。
- 読込失敗を空データとして表示する箇所を修正。工場回答入力はhydration完了前・送信中を無効化し、読込中の入力消失を防ぐ。

F&Cの色・字体・面/角丸の原則を保持。比較画像は `artifacts/ux/deal-summary-{before,after}-{390,1280}.png`。

## 検証根拠と限界

- 単体/PGlite SQL：51件成功。加えて数量/金額、採用transaction、wizard transactionの3スクリプト成功。途中失敗、rollback、同一/異なるretry、所有権、数値境界を検証。
- fixtureブラウザ：22件。案件登録→仕様→RFQ→工場回答→計算/採用→見積書/請求書→発注→工場発送→検収→顧客出荷依頼→営業承認→物流出荷/納品→案件納品完了を代表1件で確認。ロール/障害/印刷/モバイルと複数保存retryも対象。fixtureは実DB権限の証明ではない。
- 実ローカルSupabaseブラウザ：1代表業務をsales/factory/logistics/clientの別実Authユーザーで完走。最終在庫0、発注1000、見積書/請求書各1、出荷依頼と案件がdeliveredを確認。
- 実Postgres：独立接続8競合を実際のLock wait観測付きでPASS。二重出荷/検収、異なる依頼の超過、見積採用、発注重複、入庫予定同一key・異なるkey超過を対象。admin/sales/client/logistics/factory/別工場/匿名のRLS、発注UPDATE/DELETE禁止、自己admin昇格拒否もPASS。
- 実DBでSupabase既定権限とSELECT FOR UPDATEのUPDATE権限依存を発見し、044で明示revokeとUUID正規化advisory lockに修正。専用ローカルDBも同期。
- lint/typecheck/buildと差分チェックを実施。最終実行結果とcommitは完了報告参照。

メール送信、Storageアップロード、外部決済、実顧客・本番DBは試していない。メールはRFQ作成時の自動送信を除き、明示操作とprovider idempotency keyに分離。代表1件は全組合せ・全画面・負荷試験の保証ではない。

## 専用ローカルSupabaseの再現と隔離

既存Colima defaultを `--activate=false` で開始し、他contextを変えていない。専用project `baoflow-codex-20260930` と bridge `baoflow-codex-local-only` のみ使用。bridge作成は `docker --context colima network create --driver bridge --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 baoflow-codex-local-only`。API55321/DB55322。通常のCLI初期設定は全interface待受になるため、そのまま開始しない。

`supabase init --workdir local-supabase` 後、configのproject_id、api.port=55321、db.port=55322を設定。migration001/002/003と010以降047までを専用migrationディレクトリにコピーし、実データseed011/015は除外する。026のdesign_files依存で初回起動が失敗したため001/002/003を追加したのは**ローカルbootstrap専用**。本番で001/010を再適用してはならない。カタログは実テスト自身が架空の最小分類を投入する。

起動時は `--network-id baoflow-codex-local-only --exclude realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor` を指定。CLIが返す鍵を表示/ファイル保存しない。Docker inspectの実公開port HostIpとMac lsofを照合し、127.0.0.1だけと確認してから試験する。OS firewall・全体Docker設定を変更していない。

`node scripts/run-local-supabase-e2e.mjs` は専用コンテナのHostIpとAPI URLを検査してremoteを拒否し、鍵はprocess memory内のみ。実接続Playwrightはtrace/video/screenshot無効。`scripts/verify-local-postgres-races.mjs` は専用DBで合成dataを作成し、finallyで自身のdataを削除する。作業環境・架空ブラウザdataは専用local-supabaseで隔離、他コンテナ/本番は対象外。

## 残課題とリリース判断

- プレビューDBの接続先確認と、実本番相当の既存dataを持つ隔離ステージングでのmigration適合確認が必要。本番migration・push・PR・deployは別承認。
- RFQの未登録工場pending API回答を登録後に見積へ取り込む機能は対象主UIに未接続。代表経路は登録済み工場を使用。snapshotのない旧RFQは再作成を要求し、現在値へ黙って置換しない。
- request UUIDとSHA-256をactor/操作/案件別sessionStorageへ保存し、同じタブの再読込後も同一要求を保持する。フォーム内容・秘密値・回答URLは保存しない。案件/仕様/数量/RFQ/帳票/在庫証明書は本人の保存結果を読み取り復帰する。タブ終了・別ブラウザ・手動解除後の新要求を自動同定しないため、作成済み一覧/履歴の確認が必要。
- 検品費を原価とdeal_feesへ重ねる業務判断、倉庫別物流権限、旧snapshotなし帳票の完全再現、分割入庫予定の詳細入力UXは今回の代表受入範囲外。業務判断を推測して新機能化していない。
- 配送と案件完了は担当の明示確認で進める。実顧客への配送成功をテストデータで保証していない。

## migration038〜047とrollback

コードだけを先行公開せず、既存schema/RLS/関数の保存、履歴version照合、バックアップ後に新DB相当の隔離ステージングへ038→047を順番に適用し確認する。038の在庫/台帳権限、044の発注UPDATE/DELETE撤回と物流状態trigger、045の旧RFQ snapshot不足拒否が旧アプリにも影響する。旧DB031を混ぜない。

既存dataを削除しない。046は歴史的duplicateを保持し新duplicateだけ拒否する。047のcounter/docs/ledger同transaction、request保存表や044発注snapshotは監査/再試行の根拠なので、rollback時も保存する。古いアプリへ戻すだけでは安全性が戻らない。障害操作を停止し、保存した関数/権限定義との比較、帳票番号/在庫/発注/履歴整合性確認の後に必要部分のみ変更する。台帳訂正は補償取引とし、migrationの丸ごと逆適用や発行履歴削除をrollbackにしない。

## 接続断後の追加差分（2026年9月30日）

既存タスクのcompleted/idleと対象プロセス・localhostポートの停止を確認して引き継いだ。Docker/専用Supabaseを再起動せず、未commit差分だけを精査した。

- 保存結果が不明なエラー返却/通信断ではIDを保持し、異なる入力への変更を拒否する。同一内容の再試行か、履歴確認済みボタンで明示解除する。RFQ台帳payloadの案件キーは`deal`、wizard/帳票は`deal_id`であり、復帰照合を実migrationに合わせた。保存済み帳票は発行済みsnapshotを表示する。
- 043/047に本人かつstaffだけのSELECT policy/grantを追加。PGliteで本人/別営業/顧客のアクセスを検証。本番へ直接追加していない。
- メールHTMLをescapeし、RFQ/フォーム状態・期限・招待リンク対応を送信前に確認。provider idempotency keyと履歴更新失敗の表示をモック検証。実メール送信は未実行。
- Storage操作に営業権限確認を追加。DB更新/削除成功を確認してから旧blobを削除する。新uploadのDB失敗時cleanupとcleanup失敗表示をモック検証。実Storageとの連携は未検証。
- `scripts/preflight-release-038-047.sql`は読み取り専用transaction・短いtimeout・集計のみ・rollbackで審査材料を出す。RLSで集計が欠けるactorでは停止し、欠落schemaや検査失敗を成功としない。空のPGliteで構文/欠落schema/rollbackを検証。本番/既存実データでは未実行。件数だけではschema/RLS定義や履歴の適合を証明しない。
- 追加focusedテスト29件PASS（復帰4、mail/Storage16、SQL/RLS8、preflight1）。ブラウザ5件PASS（案件/RFQ/帳票の保存後応答消失→再読込復帰3、既存wizard/RFQ retry2）。fixtureのRFQ/帳票payloadも実migration形式に合わせた。ブラウザ確認はlocalhost合成データのみ、保存フォームの秘密値を永続化しないことも確認した。
- 最終lint（警告なし）/typecheck/build/差分チェックPASS。重処理は直列実行し、既知の全suite/実Supabase代表経路は再実行していない。検証用サーバーは試験終了時に停止。

追加受入はローカル条件付きであり、本番完了ではない。038〜047の審査、schema/RLS/grant/関数/履歴/既存データの保存と適合確認、隔離ステージング、mail/Storage実連携をリリース条件とする。登録済み工場の代表経路が前提で、未登録pending回答→登録後見積の主UI導線は未実装。
