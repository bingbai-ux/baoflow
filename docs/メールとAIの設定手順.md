# メールとAIの設定手順（白さん用）

作成: 2026-11-22。終わったら Claude に「設定した」と伝えてください。ダミーの取引先・工場を作って、本物のメールで通し確認をします。

鍵（英数字の長い文字列）は、チャットに貼らず、Vercel の画面にだけ貼ってください。

## 1. Resend（メールを送る・受け取るサービス）

1. https://resend.com にログイン（アカウントが無ければ作成）。
2. **Domains → Add Domain** で `bao-pkg.com` を追加。画面に出る設定値（3〜4行）を、`bao-pkg.com` を管理している画面（お名前.com など）の「DNS 設定」にそのまま写す。→ **送る**ための設定です。
3. 同じ **Domains → Add Domain** で `reply.bao-pkg.com` を追加し、**Receiving（受信）をオン**にする。画面に出る設定値（MX という種類の1行）を、同じ DNS 設定に写す。→ **返信を受け取る**ための設定です。
   - 注意: MX の行は必ず `reply` の付いた名前に入れてください。`bao-pkg.com` そのものの MX を書き換えると、普段のメールが届かなくなります。
4. 両方とも Resend の画面で **Verified** になるまで待つ（数分〜数時間）。
5. **API Keys → Create API Key** で鍵を1つ作る（権限は Full access）。→ 手順3の「メール用の鍵」。
6. **Webhooks → Add Webhook**
   - Endpoint URL: `https://baoflow-git-claude-redesign-process-1-bingbai-uxs-projects.vercel.app/api/inbound-mail`
   - Events: `email.received` だけにチェック
   - 作成後に表示される **Signing Secret**（`whsec_` で始まる）を控える。→ 手順3の「受信用の鍵」。

## 2. Supabase と Anthropic の鍵

- Supabase: プロジェクト `baoflow-v2` → **Project Settings → API Keys** → `service_role`（または Secret key）をコピー。→「管理用の鍵」。
- Anthropic: https://console.anthropic.com → **API Keys → Create Key**。→「AI用の鍵」。

## 3. Vercel に登録する

Vercel → プロジェクト `baoflow` → **Settings → Environment Variables**。下の7つを追加します。**Environment は「Preview」にチェック**（本番に出すときに Production にも足します）。

| 名前（Key） | 値（Value） |
|---|---|
| `RESEND_API_KEY` | 手順1-5 のメール用の鍵 |
| `RFQ_MAIL_FROM` | `(bao) <info@bao-pkg.com>`（差出人として見せたい表示。アドレスは `@bao-pkg.com` なら何でも可） |
| `MAIL_REPLY_DOMAIN` | `reply.bao-pkg.com` |
| `RESEND_WEBHOOK_SECRET` | 手順1-6 の受信用の鍵 |
| `SUPABASE_SERVICE_ROLE_KEY` | 手順2 の管理用の鍵 |
| `ANTHROPIC_API_KEY` | 手順2 のAI用の鍵 |
| `NEXT_PUBLIC_APP_URL` | `https://baoflow-git-claude-redesign-process-1-bingbai-uxs-projects.vercel.app` |

## 4. お試し用の画面を、外からも開けるようにする

今のお試し用の画面は、Vercel にログインした人しか開けません。このままだと Resend からの知らせ（届いたメール）も、お客さん・工場向けのリンクも止められます。

Vercel → プロジェクト `baoflow` → **Settings → Deployment Protection → Vercel Authentication** を、テストの間だけ **オフ**にしてください。
- オフにしても、BAO Flow 自体のログインは必要なままです（中の画面は見られません）。
- テストが終わったらオンに戻せます。

## 5. 作り直し（再デプロイ）

鍵は、登録したあとに作り直した画面から効きます。「設定した」と伝えてもらえれば Claude が作り直します。

## 困ったとき

- どの画面か分からない・設定値の写し先が分からない → その画面のスクリーンショットを送ってください（鍵が写っている部分は隠してください）。
