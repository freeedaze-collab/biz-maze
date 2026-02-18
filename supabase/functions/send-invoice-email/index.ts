// supabase/functions/send-invoice-email/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

/**
 * Resend を使ってメールを送信する Edge Function
 * 支払いボタン付きの HTML メールに対応
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
// NOTE: Resend requires a verified domain or 'onboarding@resend.dev' for free accounts
const FROM = Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev'

// CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}

const json = (obj: any, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders },
    ...init,
  })

Deno.serve(async (req) => {
  console.log(`[Email] Request received: ${req.method} ${req.url}`);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    if (!RESEND_API_KEY) {
      return json({ ok: false, error: 'Missing RESEND_API_KEY' }, { status: 500 })
    }

    const { to, subject, text, html: customHtml, pdfBase64, filename, checkoutUrl, invoiceNumber } = await req.json().catch(() => ({}))

    if (!to) {
      return json({ ok: false, error: 'Missing required fields: to' }, { status: 400 })
    }

    // デフォルトのHTMLテンプレート（支払いボタン付き）
    const defaultHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #1e293b;">Invoice ${invoiceNumber || ''}</h2>
        <p style="color: #475569; line-height: 1.6;">${text || 'Please find attached your invoice for recent services.'}</p>
        
        ${checkoutUrl ? `
          <div style="margin: 32px 0; text-align: center;">
            <a href="${checkoutUrl}" style="background-color: #0f172a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              Pay Invoice Now
            </a>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 12px;">Secure payment via BizMaze Pay</p>
          </div>
        ` : ''}
        
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;">
        <p style="font-size: 12px; color: #64748b;">If you have any questions, please contact our support team.</p>
      </div>
    `;

    const payload: any = {
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject: subject || `Invoice ${invoiceNumber || ''}`,
      text: text || 'Please find attached your invoice.',
      html: customHtml || defaultHtml,
    }

    if (pdfBase64) {
      payload.attachments = [
        {
          filename: filename || 'invoice.pdf',
          content: pdfBase64,
        },
      ]
    }

    console.log(`[Email] Preparing to send to: ${to}, subject: ${subject}`);
    console.log(`[Email] Preparing to send via Resend...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    const bodyText = await r.text()
    console.log(`[Email] Resend response (${r.status}): ${bodyText}`);

    if (!r.ok) {
      return json({ ok: false, error: `Resend error: ${bodyText}` }, { status: 500 })
    }

    return json({ ok: true, result: bodyText })
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
})
