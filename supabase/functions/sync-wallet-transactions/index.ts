// supabase/functions/sync-wallet-transactions/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

const COVALENT_API_KEY = Deno.env.get('COVALENT_API_KEY')!

const CHAIN_MAP: Record<string, string> = {
    'ethereum': 'eth-mainnet',
    'polygon': 'matic-mainnet',
    'arbitrum': 'arbitrum-mainnet',
    'base': 'base-mainnet',
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
    
    const covalentChainName = CHAIN_MAP[chain.toLowerCase()]
    if (!covalentChainName) {
        throw new Error(`Unsupported chain: ${chain}`)
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

    const url = `https://api.covalenthq.com/v1/${covalentChainName}/address/${walletAddress}/transactions_v2/?key=${COVALENT_API_KEY}`
    const response = await fetch(url)
    if (!response.ok) {
        const err = await response.json()
        throw new Error(`Covalent API Error: ${err.error_message}`)
    }
    const result = await response.json()
    
    const transactionsToUpsert = []
    const nativeSymbol = result.data.items.length > 0 ? result.data.items[0].gas_quote_currency_symbol : 'NATIVE'
    
    for (const tx of result.data.items) {
      if (tx.successful === false) continue; // Skip failed transactions

      // Process log events for token transfers first
      for (const log of tx.log_events) {
          if (log.decoded?.name === "Transfer" && log.decoded?.params) {
              const params = log.decoded.params.reduce((acc, p) => ({...acc, [p.name]: p.value}), {} as any)
              if(!params.from || !params.to || !params.value) continue;
              if (params.value === "0") continue; // Skip zero value transfers
              
              transactionsToUpsert.push({
                  user_id: userId,
                  tx_hash: tx.tx_hash,
                  wallet_address: walletAddress.toLowerCase(),
                  from_address: params.from.toLowerCase(),
                  to_address: params.to.toLowerCase(),
                  asset: log.sender_contract_ticker_symbol,
                  amount: parseFloat(params.value) / Math.pow(10, log.sender_contract_decimals || 18),
                  ts: tx.block_signed_at,
                  chain: chain,
                  raw_data: { ...tx, log_event: log }
              })
          }
      }
      
      // Process native currency transfers if there are no token transfers in the same tx
      if (tx.value !== "0" && tx.log_events.every(log => log.decoded?.name !== "Transfer")) {
        transactionsToUpsert.push({
          user_id: userId,
          tx_hash: tx.tx_hash,
          wallet_address: walletAddress.toLowerCase(),
          from_address: tx.from_address.toLowerCase(),
          to_address: tx.to_address.toLowerCase(),
          asset: nativeSymbol,
          amount: parseFloat(tx.value) / Math.pow(10, 18),
          ts: tx.block_signed_at,
          chain: chain,
          raw_data: tx,
        })
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
