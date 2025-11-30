// supabase/functions/sync-wallet-transactions/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORSヘッダーをこのファイル内で直接定義
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

const ETHERSCAN_API_KEY = Deno.env.get('ETHERSCAN_API_KEY')
const API_URL = 'https://api.etherscan.io/api'

interface EtherscanTx {
  hash: string; from: string; to: string; value: string; timeStamp: string;
  blockNumber: string; gasUsed: string; gasPrice: string; isError: string;
}
interface EtherscanTokenTx {
  hash: string; from: string; to: string; value: string; timeStamp: string;
  blockNumber: string; gasUsed: string; gasPrice: string;
  tokenSymbol: string; tokenDecimal: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { walletAddress } = await req.json()
    if (!walletAddress) {
      throw new Error('walletAddress is required.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const userId = user.id
    console.log(`Starting sync for user ${userId}, wallet ${walletAddress}`)

    const txlistUrl = `${API_URL}?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`
    const txResponse = await fetch(txlistUrl)
    const txResult = await txResponse.json()
    if (txResult.status !== '1') throw new Error(`Etherscan API Error (txlist): ${txResult.message}`)
    const ethTxs: EtherscanTx[] = txResult.result

    const tokentxUrl = `${API_URL}?module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${ETHERSCAN_API_KEY}`
    const tokenTxResponse = await fetch(tokentxUrl)
    const tokenTxResult = await tokenTxResponse.json()
    if (tokenTxResult.status !== '1') throw new Error(`Etherscan API Error (tokentx): ${tokenTxResult.message}`)
    const tokenTxs: EtherscanTokenTx[] = tokenTxResult.result

    const transactionsToUpsert = []

    for (const tx of ethTxs) {
      if (tx.isError === '1' || parseFloat(tx.value) === 0) continue
      transactionsToUpsert.push({
        user_id: userId,
        tx_hash: tx.hash,
        wallet_address: walletAddress.toLowerCase(),
        from_address: tx.from.toLowerCase(),
        to_address: tx.to.toLowerCase(),
        asset: 'ETH',
        amount: parseFloat(tx.value) / 1e18,
        ts: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        chain: 'ethereum',
        raw_data: tx,
      })
    }

    for (const tx of tokenTxs) {
      const decimals = parseInt(tx.tokenDecimal) || 18
      transactionsToUpsert.push({
        user_id: userId,
        tx_hash: tx.hash,
        wallet_address: walletAddress.toLowerCase(),
        from_address: tx.from.toLowerCase(),
        to_address: tx.to.toLowerCase(),
        asset: tx.tokenSymbol,
        amount: parseFloat(tx.value) / Math.pow(10, decimals),
        ts: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        chain: 'ethereum',
        raw_data: tx,
      })
    }
    
    if (transactionsToUpsert.length === 0) {
        return new Response(JSON.stringify({ message: 'No new transactions found.', count: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    const { count, error } = await supabaseAdmin
      .from('wallet_transactions')
      .upsert(transactionsToUpsert, { onConflict: 'user_id, tx_hash', ignoreDuplicates: true })
      .select()

    if (error) {
      console.error('Supabase upsert error:', error)
      throw error
    }
    
    console.log(`Successfully upserted ${count ?? transactionsToUpsert.length} transactions.`)

    return new Response(JSON.stringify({ message: 'Sync successful', count: count ?? transactionsToUpsert.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('Handler Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
