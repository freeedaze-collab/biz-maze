// supabase/functions/verify-wallet-signature/index.ts
// 要件:
//  - GET: 検証用 nonce を返す（ステートレス。保存はしない）
//  - POST: { address, signature, nonce } を受け取り、署名者(recovered)とaddressが一致するか検証
//  - 一致すれば public.wallets に upsert (verified=true)
//  - Authorization: Bearer <access_token> 必須（user_id の特定に使用）

import 'dotenv/config'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.3'
import { getAddress, verifyMessage } from 'https://esm.sh/viem@2.21.15'

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function bad(body: any, status = 400) {
  return json(body, status)
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function normalizeAddress(addr: string) {
  // 0x…40hex をチェックし checksum 化
  const lower = (addr || '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(lower)) throw new Error('Invalid address format')
  return getAddress(lower) // checksum
}

function buildMessage(nonce: string) {
  // フロントと完全一致が必要
  // ※必要なら文面を変更せず、ここを単一のソースオブトゥルースとします
  return `BizMaze wallet verification\nnonce=${nonce}`
}

async function getUserId(req: Request, supabaseUrl: string, anonKey: string) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return null

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth }}})
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

function newNonce() {
  const a = crypto.getRandomValues(new Uint8Array(16))
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const method = req.method.toUpperCase()
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const anonKey = requireEnv('SUPABASE_ANON_KEY')

    // GET: nonce を返す
    if (method === 'GET') {
      const nonce = newNonce()
      return json({ nonce })
    }

    // POST: 検証
    if (method === 'POST') {
      const uid = await getUserId(req, supabaseUrl, anonKey)
      if (!uid) return bad({ error: 'Unauthorized' }, 401)

      let body: any
      try {
        body = await req.json()
      } catch {
        return bad({ error: 'Invalid JSON' })
      }

      // フィールド名のゆらぎ両対応
      const address = body.address ?? body.wallet ?? ''
      const signature = body.signature ?? body.sig ?? ''
      const nonce = body.nonce ?? body.n ?? ''

      if (!signature || !nonce) return bad({ error: 'Missing signature or nonce' })

      // 署名メッセージを固定（フロントと一致必須）
      const message = buildMessage(nonce)

      let recovered: `0x${string}`
      try {
        recovered = await verifyMessage({
          message,
          signature,
          address: undefined, // address比較は自前で行う
        }).then((ok) => {
          // viem@2 の verifyMessage は boolean を返す実装もあるため recover を自前で
          // recover は verifyMessage ではなく recoverMessageAddress を使うパターンもある
          // ここでは recover を別APIで行う:
          return '' as any
        })
      } catch {
        // viem の boolean verify を使う代替: recoverMessageAddress
      }

      // recoverMessageAddress で復元
      const { recoverMessageAddress } = await import('https://esm.sh/viem@2.21.15/actions')
      const recoveredAddr = await recoverMessageAddress({ message, signature })
      const inputAddr = normalizeAddress(address)

      const equal = getAddress(recoveredAddr) === inputAddr
      if (!equal) {
        return bad({
          error: 'Signature does not match the address',
          dbg: { input: inputAddr, recovered: getAddress(recoveredAddr) }
        })
      }

      // DB 反映
      const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization')! }}})
      // wallets: id serial / user_id uuid / address text unique(user_id,address) / verified boolean / created_at
      const { error } = await supabase
        .from('wallets')
        .upsert({ user_id: uid, address: inputAddr, verified: true }, { onConflict: 'user_id,address' })

      if (error) return bad({ error: error.message }, 500)

      return json({ ok: true })
    }

    return bad({ error: 'Method Not Allowed' }, 405)
  } catch (e: any) {
    return bad({ error: String(e?.message || e) }, 500)
  }
})
