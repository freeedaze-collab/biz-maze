// supabase/functions/verify-wallet-signature/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isAddress, hashMessage, recoverAddress } from 'https://esm.sh/viem@2'

// 環境変数（Dashboard > Project Settings > API で確認できます）
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/** CORS 用ヘッダ（preflightも本体も同じ値を必ず返す） */
function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const CORS = corsHeaders(origin)

  // --- 1) preflight（204 は「必ず」body なし） ---
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  // --- 2) 以外は POST のみ許可 ---
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: CORS,
    })
  }

  // --- 3) 認可ヘッダ（JWT）必須 ---
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ code: 401, message: 'Missing authorization header' }),
      { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // --- 4) JSON パース ---
  let payload: any
  try {
    payload = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // --- 5) ノンス発行 ---
  if (payload?.action === 'nonce') {
    const nonce = crypto.randomUUID().replace(/-/g, '')
    return new Response(
      JSON.stringify({ nonce }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // --- 6) 署名検証 → DB upsert ---
  if (payload?.action === 'verify') {
    const { address, signature, nonce } = payload

    // 入力検証
    if (
      typeof address !== 'string' ||
      !isAddress(address) ||
      typeof signature !== 'string' ||
      typeof nonce !== 'string'
    ) {
      return new Response(
        JSON.stringify({ error: 'Bad request' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // 署名検証（EIP-191）
    const recovered = await recoverAddress({
      hash: hashMessage(nonce),
      signature,
    })
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Signature mismatch', recovered, address }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // ユーザー特定（Bearer <access_token> を forward）
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: auth } },
    })
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // wallets へ upsert（user_id + address の一意制約を想定）
    const { error: upErr } = await supabase
      .from('wallets')
      .upsert(
        { user_id: userData.user.id, address, verified: true },
        { onConflict: 'user_id,address' }
      )
    if (upErr) {
      return new Response(
        JSON.stringify({ error: 'DB upsert failed', details: upErr.message }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // それ以外の action
  return new Response(
    JSON.stringify({ error: 'Unknown action' }),
    { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
