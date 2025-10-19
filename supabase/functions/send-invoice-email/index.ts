// supabase/functions/send-invoice-email/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

/**
 * Resend を使って PDF 添付メールを送信する Edge Function
 * 必要なシークレット:
 *  - RESEND_API_KEY
 * 既定 From は Verified ドメインのアドレスに置き換えてください。
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM = Deno.env.get('RESEND_FROM') || 'Invoices <invoices@example.com>'

// CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

const json = (obj: any, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders },
    ...init,
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    if (!RESEND_API_KEY) {
      return json({ ok: false, error: 'Missing RESEND_API_KEY' }, { status: 500 })
    }

    const { to, subject, text, pdfBase64, filename } = await req.json().catch(() => ({}))
    if (!to || !pdfBase64) {
      return json({ ok: false, error: 'Missing required fields: to, pdfBase64' }, { status: 400 })
    }

    const payload = {
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject: subject || 'Invoice',
      text: text || 'Please find attached your invoice.',
      attachments: [
        {
          filename: filename || 'invoice.pdf',
          content: pdfBase64, // Resend は base64 を受け付ける
        },
      ],
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const body = await r.text()
    if (!r.ok) {
      return json({ ok: false, error: `Resend error: ${body}` }, { status: 500 })
    }

    return json({ ok: true, result: body })
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
})
