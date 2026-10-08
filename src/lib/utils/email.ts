/**
 * Email Utility using Resend
 * https://resend.com/
 */

import { Resend } from 'resend'

const mailFrom = process.env.RFQ_MAIL_FROM
const resend = process.env.RESEND_API_KEY && mailFrom
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export interface EmailParams {
  to: string
  subject: string
  body: string // HTML
}

/**
 * Send an email using Resend
 * @param params Email parameters
 * @returns Success status
 */
export async function sendEmail({ to, subject, body }: EmailParams): Promise<boolean> {
  if (!resend || !mailFrom) {
    console.log('[Email] RESEND_API_KEY or RFQ_MAIL_FROM not set; email not sent')
    return false
  }

  try {
    const { error } = await resend.emails.send({
      from: mailFrom,
      to,
      subject,
      html: body,
    })

    if (error) {
      console.error('[Email] Failed to send:', error)
      return false
    }

    console.log('[Email] Sent successfully:', subject, 'to', to)
    return true
  } catch (error) {
    console.error('[Email] Error:', error)
    return false
  }
}

/**
 * Send email to multiple recipients
 * @param recipients Array of email addresses
 * @param subject Email subject
 * @param body HTML body
 */
export async function sendEmailToMany(
  recipients: string[],
  subject: string,
  body: string
): Promise<void> {
  await Promise.all(
    recipients.map((to) => sendEmail({ to, subject, body }))
  )
}
