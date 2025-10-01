// supabase/functions/sync-wallet-transactions/index.ts
// Deno runtime (Supabase Edge Functions)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { preflight, corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  // 1) Preflight (OPTIONS)
  const pf = preflight(req)
  if (pf) return pf

  // 2) 認証（例：JWT必須にしたい場合は Authorization: Bearer を検証）
  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { ...corsHeaders(req), 'Content-Type': 'text/plain' },
    })
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { ...corsHeaders(req), 'Allow': 'POST,OPTIONS' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const chain = body?.chain ?? 'polygon'

    // ---- ここから同期ロジック（ダミー） ----
    // Alchemyなどを使って取引を取得 → Supabaseに保存
    // 例: const imported = await syncTransactions({ chain, ... })
    const imported = 0
    // ---- ここまで ----

    return new Response(JSON.stringify({ ok: true, imported }), {
      status: 200,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(`Error: ${e?.message ?? e}`, {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'text/plain' },
    })
  }
})
