# Stage11 再交渉・最終UI監査候補

本番未適用。Stage10 cf58435b を基点に追加。CLI生成migrationは依存順を守るため20261001190000へ並べ直した。新表なし。

## 再交渉の境界
発注前のみ。新RFQ/工場回答・数量選択・価格改訂/採用で新しい見積版を発行し、旧請求の差引着金引継ぎ額を新見積に固定。顧客が新価格/数量/支払条件/引継ぎ額を明示承認してから、新発行請求書へ差し替える。旧請求/旧回答/着金は削除・移動せず旧版へ。新請求の未収は新総額−差引着金。旧価格の請求への入金申告は再確認中として画面/RPCで停止。

未確認入金申告・既存発注・過剰着金・承認後の引継ぎ額変更は拒否。過剰分は銀行実施済み返金を先に記録し、変更後の額を新見積で再承認する。実送金・相殺・銀行連携はなし。発注済み案件の再契約/返品/回収はこの処理では扱わない。

新RPC preview_client_price_reissue(uuid,uuid,uuid) はauthenticated EXECUTE、関数内staff必須、anon/PUBLIC剥奪。client_finance_commandの2操作を追加/拡張、顧客respond_quoteには引継ぎ確認項目を追加。既存staff_client_finance_summaryは既存権限内で現行価格/承認/必要前払額の読取項目を追加。新表0、31表のRLS/GRANT/Storage範囲拡張0。公開前のmigration/権限審査対象に含める。

## UI監査範囲
Nextのprivate underscoreディレクトリを除いた現役page44件を棚卸し。staff各工程・一覧/設定/分析/履歴、client/factory/logistics、外部登録/RFQ/招待、ログイン/パスワード、印刷を分類。全画面に同じ説明バナーを追加せず、主操作・未入力/待ちの理由・一覧検索・戻る・44px操作・390px横overflowを確認。

修正: 案件上部の4業務台帳リンクは折畳みへ整理しRFQ主操作の押し下げを解消。現在の承認/差替/net着金不足を履歴のpaidより優先した次操作。工場のRFQ/発注検索と発注種別絞込、繰返しWasabi強調を抑制。物流/顧客配送一覧検索と詳細を開く次操作。

分類大中小は既存catalogのparent階層＋各自由入力。仕様追加/数量候補追加/商品切替は既存CaseProducts/ProductSpecEditor。上部工程＋右の連絡記録折畳を維持。連絡記録は未接続chatと区別。現役srcに通貨切替state/未配線toggleはなく、工場USD・顧客JPY・保存FXを項目に明示。

## 受入記録
最初のnative再交渉1件合格（9.2秒、計11.9秒）：2商品、数量候補2/4と5/8、2工場、実RFQ8回答、各工場の数量4/8を価格改訂して採用、新総額6600・旧着金550・未収6050、顧客再承認/旧請求申告停止/新請求/履歴保持/他社工場物流拒否/390px。
最終UI/native受入:
- 横断browser16件合格（モバイルRFQ押下位置修正後）、工場検索/取消表示の対象1件合格（1.5秒、計4.8秒）。現役44pageの全てを棚卸しし、空/履歴/エラー/戻る/ロール/モバイルと動的業務詳細を検証層に割当。
- 実DB統合8件: 一括6件合格＋2件のfixture修正後合格（部分QC31.3秒、代表28.0秒、計1.0分）。古い代表のボタン名を現行支払条件へ更新。部分QCのAPI時刻を観測済みDB時刻へ修正し、非同期の端末時計由来の偽の未来時刻を除去。SQLの未来/作成前/逆順拒否を緩和していない。
- 再価格のPDF/mail/顧客状態絞込を最終差分で再確認1件合格（14.0秒、計16.7秒）。Mailpitに6600/550/6050/支払期限、数量4/8のPDF添付が到達しbytes一致。PDF抽出/1page目視も合格。
- focused24件（SQL15/mail7/実事実の案件次操作2）合格。最終lint/typecheck/buildは最新PDF・帳票状態絞込後にも合格。専用Supabase停止、container/volume0件、起動停止ログ削除を確認。
- artifacts/ui-final-stage11の営業案件/請求/在庫、顧客/工場/物流6画面とprice-renegotiation-stage11の顧客新請求/差替PDFを保存。Libraryへ添付はしていない。合成データだけ。

## 復旧・公開
Stage10のnet/immutable journalの復旧注意を継承。事実が生じた後に旧gross-only判定へ戻さない。UI停止でもcash familyと再送予約は保存。fresh本番backup/restorepointと以降書込差分照合、未公開sample/Stage4–11権限承認、正本SHA/build一致が必要。実顧客コピー/新課金/新credential/実取引先testmailを行わない。
