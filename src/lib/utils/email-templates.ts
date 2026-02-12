/**
 * Email Templates for BAO Flow
 * All templates are in Japanese and use HTML format
 */

const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.baoflow.com'

// Base email wrapper
function wrapEmail(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f2f2f0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 14px;
      padding: 32px;
    }
    .header {
      font-size: 20px;
      font-weight: 600;
      color: #0a0a0a;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 16px;
      font-weight: 500;
      color: #0a0a0a;
      margin-bottom: 32px;
    }
    .logo span {
      opacity: 0.5;
    }
    p {
      color: #555555;
      font-size: 14px;
      line-height: 1.7;
      margin: 0 0 16px 0;
    }
    .button {
      display: inline-block;
      background: #0a0a0a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      margin: 16px 0;
    }
    .info-box {
      background: #f2f2f0;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
    }
    .info-label {
      font-size: 11px;
      color: #888888;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 14px;
      color: #0a0a0a;
      font-weight: 500;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e8e8e6;
      font-size: 11px;
      color: #888888;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo"><span>(</span>bao<span>)</span> flow</div>
      ${content}
      <div class="footer">
        このメールはBAO Flowから自動送信されています。<br>
        返信いただいてもお答えできませんのでご了承ください。
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Quote Ready Email (M06)
 * Sent to client when quote is ready for review
 */
export function quoteReadyEmail(
  clientName: string,
  dealCode: string,
  productName: string,
  portalUrl?: string
): { subject: string; body: string } {
  const url = portalUrl || `${PORTAL_URL}/portal/orders`

  return {
    subject: `お見積もりのご案内 [${dealCode}]`,
    body: wrapEmail(`
      <div class="header">お見積もりのご案内</div>
      <p>${clientName}様</p>
      <p>
        いつもお世話になっております。<br>
        ご依頼いただいておりました「${productName}」のお見積もりが完成いたしました。
      </p>
      <div class="info-box">
        <div class="info-label">案件番号</div>
        <div class="info-value">${dealCode}</div>
      </div>
      <p>
        下記ボタンより、ポータルにてお見積もり内容をご確認いただけます。<br>
        ご不明な点がございましたら、お気軽にお問い合わせください。
      </p>
      <a href="${url}" class="button">見積もりを確認する</a>
    `),
  }
}

/**
 * Order Confirmation Email (M11)
 * Sent to client when order is approved/confirmed
 */
export function orderConfirmEmail(
  clientName: string,
  dealCode: string,
  productName: string
): { subject: string; body: string } {
  return {
    subject: `ご注文確認 [${dealCode}]`,
    body: wrapEmail(`
      <div class="header">ご注文ありがとうございます</div>
      <p>${clientName}様</p>
      <p>
        この度は「${productName}」をご注文いただき、誠にありがとうございます。<br>
        ご注文内容を確認し、製造の準備を進めてまいります。
      </p>
      <div class="info-box">
        <div class="info-label">案件番号</div>
        <div class="info-value">${dealCode}</div>
      </div>
      <p>
        製造が開始されましたら、改めてご連絡いたします。<br>
        今後ともよろしくお願いいたします。
      </p>
      <a href="${PORTAL_URL}/portal/orders" class="button">注文状況を確認する</a>
    `),
  }
}

/**
 * Shipping Notification Email (M22)
 * Sent to client when order is shipped
 */
export function shippingNotifyEmail(
  clientName: string,
  dealCode: string,
  productName: string,
  trackingNumber?: string,
  trackingUrl?: string
): { subject: string; body: string } {
  const trackingInfo = trackingNumber
    ? `
      <div class="info-box">
        <div class="info-label">トラッキング番号</div>
        <div class="info-value">${trackingNumber}</div>
      </div>
      ${trackingUrl ? `<a href="${trackingUrl}" class="button">配送状況を追跡する</a>` : ''}
    `
    : ''

  return {
    subject: `発送のお知らせ [${dealCode}]`,
    body: wrapEmail(`
      <div class="header">商品を発送しました</div>
      <p>${clientName}様</p>
      <p>
        「${productName}」を発送いたしました。<br>
        到着まで今しばらくお待ちください。
      </p>
      <div class="info-box">
        <div class="info-label">案件番号</div>
        <div class="info-value">${dealCode}</div>
      </div>
      ${trackingInfo}
      <p>
        配送に関するご質問がございましたら、お気軽にお問い合わせください。
      </p>
    `),
  }
}

/**
 * Payment Reminder Email
 * Sent to client when payment is due
 */
export function paymentReminderEmail(
  clientName: string,
  dealCode: string,
  amount: string,
  dueDate?: string
): { subject: string; body: string } {
  const dueDateInfo = dueDate
    ? `<p>お支払い期限: <strong>${dueDate}</strong></p>`
    : ''

  return {
    subject: `お支払いのご確認 [${dealCode}]`,
    body: wrapEmail(`
      <div class="header">お支払いのご確認</div>
      <p>${clientName}様</p>
      <p>
        下記のご請求につきまして、お支払いのご確認をお願いいたします。
      </p>
      <div class="info-box">
        <div class="info-label">案件番号</div>
        <div class="info-value">${dealCode}</div>
        <div class="info-label" style="margin-top: 12px;">ご請求金額</div>
        <div class="info-value">${amount}</div>
      </div>
      ${dueDateInfo}
      <p>
        すでにお支払い済みの場合は、本メールをご容赦ください。<br>
        ご不明な点がございましたら、お気軽にお問い合わせください。
      </p>
      <a href="${PORTAL_URL}/portal/orders" class="button">請求内容を確認する</a>
    `),
  }
}

/**
 * Delivery Complete Email (M25)
 * Sent to client when order is delivered
 */
export function deliveryCompleteEmail(
  clientName: string,
  dealCode: string,
  productName: string
): { subject: string; body: string } {
  return {
    subject: `納品完了のお知らせ [${dealCode}]`,
    body: wrapEmail(`
      <div class="header">納品が完了しました</div>
      <p>${clientName}様</p>
      <p>
        「${productName}」の納品が完了いたしました。<br>
        ご確認いただけますと幸いです。
      </p>
      <div class="info-box">
        <div class="info-label">案件番号</div>
        <div class="info-value">${dealCode}</div>
      </div>
      <p>
        商品に関するご質問やご要望がございましたら、お気軽にお問い合わせください。<br>
        またのご利用を心よりお待ちしております。
      </p>
      <a href="${PORTAL_URL}/portal/orders" class="button">注文履歴を確認する</a>
    `),
  }
}

/**
 * Payment Received Email (M14)
 * Sent to client when payment is confirmed
 */
export function paymentReceivedEmail(
  clientName: string,
  dealCode: string,
  amount: string
): { subject: string; body: string } {
  return {
    subject: `ご入金確認のお知らせ [${dealCode}]`,
    body: wrapEmail(`
      <div class="header">ご入金を確認しました</div>
      <p>${clientName}様</p>
      <p>
        下記のご入金を確認いたしました。<br>
        ありがとうございます。
      </p>
      <div class="info-box">
        <div class="info-label">案件番号</div>
        <div class="info-value">${dealCode}</div>
        <div class="info-label" style="margin-top: 12px;">ご入金額</div>
        <div class="info-value">${amount}</div>
      </div>
      <p>
        製造・出荷に向けて準備を進めてまいります。<br>
        進捗がございましたら、改めてご連絡いたします。
      </p>
      <a href="${PORTAL_URL}/portal/orders" class="button">注文状況を確認する</a>
    `),
  }
}
