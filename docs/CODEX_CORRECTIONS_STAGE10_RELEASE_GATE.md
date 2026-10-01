# Stage10 訂正・再共有・返金記録候補

本番未適用。新表・実送金・実顧客メール・データ補完なし。

- 同じ請求の訂正版: 数量・税込額・税・期限・支払条件が一致する新発行版だけ許可。旧版をsupersededにし、旧リンクを無効化。元の着金行は移動/削除せず、同じ顧客/案件の請求系列として一度だけ合算。未確認申告がある場合は先に銀行確認/却下。金額変更を伴う着金済み請求の振替/相殺は未実装。
- リンク更新: 有効リンクが残る間は不可。期限切れ後、同じ固定版に新7日リンク。古いリンクで回答/申告できない。
- 同版再送: 前回受付済み＋登録顧客の明示依頼だけ。既存の不変request journalへ予約→外部POST→結果を追記。依頼UUIDの初回だけclaimed=true、同UUID再試行はfalse。予約済み/結果不明/拒否の後は新依頼も止める。受付と到達は別表示。
- 返金: 銀行で実施済みの事実だけ追記。実着金総額−実施済み返金=差引着金。重複照合番号・超過・未来日・顧客操作を拒否。元の着金/工程履歴を削除せず、以降の発注/発送の必要着金判定に差引額を使用。実行済み発注や出荷を自動で巻き戻さない。
- 顧客: 自社の旧版/取消版は履歴閲覧と状態印付きPDFのみ。旧版への回答/入金申告不可。期限切れ/誤ったtokenを渡した際に履歴読取へ迂回しない。

## 権限差分（公開前審査）
既存31表の権限変更なし。新RPC preview_client_reissue / client_document_send_state / finish_client_document_resend / staff_client_finance_summary はauthenticated呼出可、関数内で営業/管理者必須。他社・工場・物流・顧客は不可。内部client_payment_family/client_payment_totalsはPUBLIC/anon/authenticated EXECUTE剥奪。顧客の旧版読取は既存自社packet SELECT policyを使用。新表やTRUNCATE/default ACL変更なし。

## ロールバック
適用前の既存関数定義を安全な承認済みバックアップで保持し、通常はforward修正する。新機能で事実が生じた後、古いgross-only着金判定へ単純に戻すと返金を無視して発注/発送が可能になるため不可。UIだけ無効化してjournal/系列/net判定を維持。旧メール履歴と予約は残し、予約を削除して再送可能にしない。復元後に送信/銀行の外部事実と差分照合が必要。

## 受入
SQL14、メールaction7合格。lint/typecheck/buildは画面追加後に一度合格。実Auth/PostgREST/StorageなしのDB台帳・画面native1件合格（14.1秒、計16.9秒）。半金550→訂正版引継ぎ→旧版自社readonly/PDF・誤token拒否→銀行実施済み返金100・net450→リンク更新→初回Mailpit→同版再送Mailpit、PDF添付bytes一致・数量金額期限・他社/工場/物流拒否・390px横overflowなしを確認。画像 artifacts/client-corrections-stage10/staff-corrections-390.png。最終lint/typecheck/build合格。focused21件（SQL14＋mail7）合格。既存half/postpaidと部分QC分納native3件も直列49.3秒で合格。専用Supabaseは停止・使い捨てvolume削除、鍵が含まれうる起動ログ削除。空状態/帳票への戻る/自社帳票なし/誤token/390pxのfixture browser1件も合格（5.7秒、計8.4秒）。全ページ監査・価格再交渉のnative通し・本番バックアップ再認証は別の未完工程。
