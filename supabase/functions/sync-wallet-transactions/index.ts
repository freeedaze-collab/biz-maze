// supabase/functions/sync-wallet-transactions/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

// CovalentのAPIキーを環境変数から取得
const COVALENT_API_KEY = Deno.env.get('COVALENT_API_KEY')!

// Covalentが要求するチェーン名への変換マップ
const CHAIN_NAME_MAP: Record<string, string> = {
    'ethereum': 'eth-mainnet',
    'polygon': 'matic-mainnet',
    'arbitrum': 'arbitrum-mainnet',
    'base': 'base-mainnet',
    // 将来的に他のチェーンを追加する場合は、ここに追加します
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { walletAddress, chain } = await req.json()
    if (!walletAddress || !chain) {
      throw new Error('walletAddress and chain are required.')
    }
    
    const covalentChainName = CHAIN_NAME_MAP[chain.toLowerCase()]
    if (!covalentChainName) {
        throw new Error(`Unsupported or unrecognized chain: ${chain}`)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) throw new Error('Unauthorized')

    const userId = user.id
    console.log(`Starting Covalent sync for user ${userId}, wallet ${walletAddress} on ${covalentChainName}`)

    // Covalent APIのエンドポイント (トランザクションV3を推奨)
    const url = `https://api.covalenthq.com/v1/${covalentChainName}/address/${walletAddress}/transactions_v3/?key=${COVALENT_API_KEY}`
    const response = await fetch(url)
    if (!response.ok) {
        const errData = await response.json()
        throw new Error(`Covalent API Error: ${errData.error_message}`)
    }
    const result = await response.json()
    
    if (!result.data || !result.data.items) {
        throw new Error('Invalid response structure from Covalent API.')
    }

    const transactionsToUpsert = []
    
    for (const tx of result.data.items) {
      // 全ての送金イベント (ネイティブ通貨、トークン) をループ処理
      for (const log of tx.log_events) {
          if (log.decoded?.name === "Transfer" && log.decoded?.params) {
              const from = log.decoded.params.find(p => p.name === "from")?.value
              const to = log.decoded.params.find(p => p.name === "to")?.value
              const value = log.decoded.params.find(p => p.name === "value")?.value

              if(!from || !to || !value) continue;
              
              transactionsToUpsert.push({
                  user_id: userId,
                  tx_hash: tx.tx_hash,
                  wallet_address: walletAddress.toLowerCase(),
                  from_address: from.toLowerCase(),
                  to_address: to.toLowerCase(),
                  asset: log.sender_contract_ticker_symbol || 'Unknown Token',
                  amount: parseFloat(value) / Math.pow(10, log.sender_contract_decimals || 18),
                  ts: tx.block_signed_at,
                  chain: chain,
                  raw_data: { ...tx, matched_log: log } // どのログか分かるように保存
              })
          }
      }
    }

    if (transactionsToUpsert.length === 0) {
        return new Response(JSON.stringify({ message: 'No new transactions found.', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { count, error } = await supabaseAdmin
      .from('wallet_transactions')
      .upsert(transactionsToUpsert, { onConflict: 'user_id, tx_hash', ignoreDuplicates: true })
      .select()

    if (error) throw error

    return new Response(JSON.stringify({ message: 'Sync successful', count: count?.length ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
