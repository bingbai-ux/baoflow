# Stage12 案件会話・顧客サンプル請求・日次参考FX

ローカル候補。本番正本はStage1 main f5ae38655d54b8eaf3142badbcf4856b20f585edのまま。新migration 20261001200000 / 20261001200100は未適用・未承認。本番Auth・権限・Storage・env・メール・既存データ変更なし。

## 変更

- 案件右パネルで営業↔自社顧客、営業↔当該RFQ/サンプル/発注工場、営業↔割当物流本人の会話を別室に分離。顧客/工場/物流のmessagesページと一覧への戻りを追加。営業は相手を明示して開室、外部ロールは参加可能な既存室だけ。
- テキスト2000文字、HTMLはplain text、最新100件/以前の100件、厳密連番、未読カーソルは後退不可。表示中だけ15秒polling＋手動更新。未選択でも未読一覧を確認する。同一連番の無用な既読writeを避ける。Realtime契約・外部メッセンジャー・自動翻訳・添付・メール通知/返信取込は追加しない。
- 本文をブラウザ永続化しない。actor/room別UUID＋SHA256のみ。応答断時は履歴/要求IDを確認し、結果不明で別要求を作らない。確実なSQL拒否＋認可された不在確認でのみ修正を許す。同時同UUIDは1件。未送信入力を別相手へ黙って移さない。
- sample_invoicesの発行時実顧客IDを列とsnapshotに固定。顧客は自社宛の固定請求額・数量・期限・PDFだけ。cost_idと社内取消理由を除く。工場原価/支払/メール台帳SELECTは増やさない。旧宛先未保存分を現在の案件から推測公開しない。取消PDFは履歴用の表示を追加、有効PDFのbytesは変わらない。
- 既存鍵不要open.er-api.com日次参考値をUSD基点で取得。JPY/USDとJPY/CNY（同一基準時点のJPY÷CNY）を表示、担当者確認後に新価格版へ固定。as_ofは取得元のUnix日時でありローカル取得日時ではない。取得失敗/未来/30時間超/次回更新＋6時間超/不正base・rateは停止し、確認済み手入力を案内。fallbackを成功/最新扱いしない。
- CNY費目は額×JPY/CNY÷JPY/USDでUSD原価に一度だけ変換。工場RFQ単価は従来USDのまま。税/円単価切上げ・固定売価・旧価格/PDF保持は従来通り。料金表未確定をFX取得で補完しない。
- provider商用換算/キャッシュ可能・出典表示必須・raw feed再配布不可を公式docs/termsで確認。ページに出典リンク。銀行決済レートではなく日次参考値と明示。新契約/鍵/料金なし。https://www.exchangerate-api.com/docs/free / https://www.exchangerate-api.com/terms

## 本番で承認が必要な差分

| 対象 | 現状→候補 | 業務影響 |
|---|---|---|
| chat_rooms/chat_messages（既存2表） | 広い既存policy/直接write→相手別SELECT RLSと限定RPC投稿。PUBLIC継承write/TRUNCATE含め剥奪 | 営業管理者は全室履歴、顧客/工場は自社かつ当該案件、物流は割当本人だけ。全員直接INSERT/UPDATE/DELETE不可、匿名不可。旧peer未保存室は営業のみ、外部へ履歴自動公開しない |
| case_chat_reads（新1表） | なし→RLS、直接GRANTなし、本人カーソルRPC | 各自の閲覧済み連番のみ保存。他人・別室・未来番号不可 |
| sample_invoices（既存） | staffのみ→発行時宛先列/固定snapshotとclient_sample_invoices RPC | 顧客は自社請求/PDFのみ読取、社内費用等不可。旧宛先欠損分はstaffのみ。再発行で実顧客を確認してから公開 |
| quote_cost_lines/既存pricing RPC | USD/JPY費目→CNY追加・JPY/CNY固定 | staffのみ新価格版で換算。旧版を更新せず、一般顧客/工場/物流の原価アクセスは増やさない |

今回の新業務RPCは7（open/send/read/mark/list/targets chatの6＋client_sample_invoicesの1）。RLS判定helper case_chat_allowedはauthenticated EXECUTEだがbooleanのみ、相手検証helperとinvoice triggerは一般EXECUTEなし。外部ロールの任意開室・相手一覧は禁止。chat_rooms/messages旧直接書込を使うコードは非公開_archiveのみで現役48pageに利用なし。アーカイブ再有効化には新RPC配線が必要。

未公開新台帳は31→32表（case_chat_reads＋1）。Stage3の承認済2表は別。Storage/新credential/default ACLへのStage12追加変更0。既承認のsupabase_admin将来table default TRUNCATE残置を広げない。

## 受入と復旧

受入ログの最終確定は下欄。localhost専用合成Auth/Postgres/Storage/Mailpit、worker1。FX UIは外部通信拒否を維持するtest preload合成feed、別のread-only公開API確認は2026-10-01T18:30:00.045Zに基準日時2026-10-01T00:02:31Z、JPY/USD 157.298282、JPY/CNY 23.41836222125815で成功。これは本番設定/顧客送信の合格ではない。

本番のfresh backup復元点/戻し方/その後の書込差分、Stage4–12の統合権限審査が必要。適用はDB→同一SHAアプリ、旧UIを新台帳writeへ戻さない。切戻しは新chat送信停止/新リンクを隠し、限定RLSと固定請求を保持してforward fix。旧authenticated_full_accessの復活、列/履歴削除、旧宛先の推測backfillはしない。復元が必要なら承認済provider復元と復元点以降のchat/金融/請求履歴差分を先に照合する。顧客データexport/新課金/外部テストメールは対象外。

## 必須未確認

- 本番fresh backup認証と復元点、適用後書込差分手順、未公開32台帳＋既存RPC/権限の承認。
- 海源の正式料金表版/重量容積/最低料金/追加料金/丸め/食品区分、正式宛先と登録配送業者。推測値不使用。
- carrier追跡・食品手続APIの契約/scope/正本仕様。本番メールの利用可能な既存設定と送信元/到達。秘密の新入力は本人境界。
- 旧見積6件の仕様正本。勝手にvariant紐付けしない。旧サンプル宛先欠損分は原請求と顧客の確認が必要。
- 工場RFQのCNY単価化、chat添付/通知/翻訳/外部返信同期は今回のテキスト・参考費目範囲外で、未実装を明示。

## 最終検証

- focused 20/20 PASS: chat/samples SQL 3、公開FXの鮮度/方向/fallback 3、JS pricing 4、pricing SQL 6、staff-only sample mail/重複停止 4。
- 実Auth native 3ケースPASS: 営業/顧客/工場/担当物流chat・未読・plain text・応答断復帰・同時同UUID・org変更拒否＋合成日次FX UI→担当確認→CNY DB preview、sample自社取消PDF/他role拒否・取消再発行・Mailpit/PDF bytes、CNY費目を含む2商品価格再交渉→新価格顧客承認→6600請求/550引継ぎ/6050未収/PDF/Mailpit。物流chatは既存条件確認済みの合成案件/発注/割当が前提、運送全工程をこのchatケースの成果とは数えない。
- fixture browser 25 distinct PASS（最初24/25、既存支払工程の旧テスト文言だけ更新し対象1/1再確認）。現役48page棚卸し、desktop/390px、営業/顧客/工場/物流、未採用guard、検索/empty/error/戻る、仕様/数量・価格保存復帰。各動的詳細の業務受入はStage11 nativeと今回nativeで補完。
- 最終同一source: lint/typecheck/build PASS、diff --check PASS。重い検証worker1・直列。
- 画面証拠: artifacts/chat-stage12/{client,factory,logistics,staff-case,fx-reference-preview}-390.png、sample-stage12/client-own-sample-390.png、pricing-stage12/client-new-invoice-390.png、ui-final-stage12のrole/main画面。Stage11以前の証拠は上書きせず保持。Library IDは未作成。
- 最終ローカル環境停止済み、専用コンテナ0/volume0をread-only確認。CLI鍵出力ログ削除済み。本番変更なし。
