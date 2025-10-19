// supabase/functions/preflight_transfer/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

/**
 * 目的:
 * - 送金前の概算手数料 (fee_usd) を返す
 * - 受取アドレス `to` の実在性チェック (exists)：
 *    - code != '0x' (コントラクトあり) OR
 *    - balance > 0 OR
 *    - txCount > 0
 *   のいずれかで true
 *
 * 環境変数 (プロジェクトの Edge Functions > Settings > Environment variables):
 * - RPC_URL : EVM JSON-RPC のエンドポイント (Polygon/ETH など)
 * - FEE_USD_FALLBACK : 見積りができないときのデフォルト (例: "0.35")
 * - FX_USD_PER_NATIVE (任意): ネイティブ通貨→USD の変換 (例: 1ETH=USD, 1MATIC=USD)。未設定なら概算計算で対応。
 */
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

const JSON_OK = (obj: Record<string, unknown>, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors },
    ...init,
  })

type Json = Record<string, unknown> | null

async function rpc(method: string, params: unknown[]): Promise<Json> {
  const RPC_URL = Deno.env.get('RPC_URL')
  if (!RPC_URL) return { error: 'RPC_URL not configured' }

  const body = { jsonrpc: '2.0', id: 1, method, params }
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { error: `rpc ${method} failed: ${res.status}` }
  const json = await res.json()
  return json?.result ?? null
}

function hexToBn(hex: string | null): bigint {
  if (!hex || typeof hex !== 'string') return 0n
  try {
    return BigInt(hex)
  } catch {
    return 0n
  }
}

function weiToEth(wei: bigint): number {
  // 1e18
  return Number(wei) / 1e18
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }

  try {
    const isGet = req.method === 'GET'
    const body = isGet ? {} : await req.json().catch(() => ({}))
    const to = (isGet ? new URL(req.url).searchParams.get('to') : body?.to) as string | null
    const amount = Number(isGet ? new URL(req.url).searchParams.get('amount') : body?.amount) || 0
    const checkOnly = !!(isGet ? new URL(req.url).searchParams.get('checkOnly') : body?.checkOnly)

    // ==== 実在性チェック ====
    let exists = false
    if (to && /^0x[0-9a-fA-F]{40}$/.test(to)) {
      const [code, balanceHex, txCountHex] = await Promise.all([
        rpc('eth_getCode', [to, 'latest']),            // string | '0x'
        rpc('eth_getBalance', [to, 'latest']),         // hex
        rpc('eth_getTransactionCount', [to, 'latest']) // hex
      ])

      const balance = hexToBn(balanceHex as string | null)
      const txCount = hexToBn(txCountHex as string | null)
      const hasCode = !!(typeof code === 'string' && code !== '0x')

      exists = hasCode || balance > 0n || txCount > 0n
    } else {
      exists = false
    }

    // チェックのみモード（バリデーション用）
    if (checkOnly) {
      return JSON_OK({ ok: true, exists })
    }

    // ==== 概算手数料 ====
    // できれば最新 gasPrice と標準 gasLimit を使って概算
    let feeUsd = Number(Deno.env.get('FEE_USD_FALLBACK') ?? '0.35') // フォールバック
    try {
      const gasPriceHex = await rpc('eth_gasPrice', [])
      const gasPriceWei = hexToBn(gasPriceHex as string | null)      // wei/gas
      // シンプル送金想定: 21,000 gas（チェーンにより+α）
      const gasLimit = 21_000n
      const feeWei = gasPriceWei * gasLimit
      const feeNative = weiToEth(feeWei) // ETH/MATIC など

      // 簡易換算: 固定レート or フォールバック
      const FX = Number(Deno.env.get('FX_USD_PER_NATIVE') ?? '0') // 未指定なら 0
      if (FX > 0) {
        feeUsd = feeNative * FX
      } else {
        // レート不明ならヒューリスティック（ETH: 1 native ~ $2000, MATIC: 1 ~ $0.6 等）
        // ガス代は通常ごく小さいので固定フォールバックのほうが安定
      }
      // 小数丸め
      feeUsd = Math.max(0, Number(feeUsd.toFixed(4)))
    } catch {
      // noop（フォールバックを使う）
    }

    return JSON_OK({
      ok: true,
      to,
      amount,
      exists,
      fee_usd: feeUsd,
    })
  } catch (e: any) {
    return JSON_OK({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
})
