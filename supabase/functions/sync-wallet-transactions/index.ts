import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Environment variables for API access
const ALCHEMY_API_KEY = Deno.env.get('ALCHEMY_API_KEY');
const COINGECKO_API_BASE = Deno.env.get('COINGECKO_API_BASE') || 'https://api.coingecko.com/api/v3';

// Chain configuration
const SUPPORTED_CHAINS = {
  1: { name: 'ethereum', alchemyNetwork: 'eth-mainnet', nativeSymbol: 'ETH', coingeckoId: 'ethereum' },
  137: { name: 'polygon', alchemyNetwork: 'polygon-mainnet', nativeSymbol: 'MATIC', coingeckoId: 'matic-network' }
};

interface SyncWalletInput {
  userId: string;
  walletAddress: string;
  chainIds: number[];
  since?: string;
  cursor?: string | null;
}

interface SyncWalletOutput {
  inserted: number;
  updated: number;
  nextCursor: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const input: SyncWalletInput = await req.json();
    const { userId, walletAddress, chainIds, since, cursor } = input;

    console.log(`Syncing transactions for user ${userId}, wallet ${walletAddress}, chains: ${chainIds.join(',')}`);

    let totalInserted = 0;
    let totalUpdated = 0;
    let nextCursor: string | null = null;

    // Process each chain
    for (const chainId of chainIds) {
      const chainConfig = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
      if (!chainConfig) {
        console.warn(`Unsupported chain ID: ${chainId}`);
        continue;
      }

      try {
        // Fetch transfers from Alchemy
        const transfers = await fetchAlchemyTransfers(walletAddress, chainId, chainConfig, since, cursor);
        
        // Process and normalize transactions
        for (const transfer of transfers.result) {
          const normalizedTx = await normalizeTransaction(transfer, chainId, chainConfig, userId);
          
          if (normalizedTx) {
            // Upsert transaction with idempotency
            const { data, error } = await supabase
              .from('transactions')
              .upsert(normalizedTx, { 
                onConflict: 'chain_id,transaction_hash,log_index',
                ignoreDuplicates: false 
              })
              .select('id');

            if (error) {
              console.error('Error upserting transaction:', error);
            } else {
              if (data && data.length > 0) {
                totalInserted++;
              } else {
                totalUpdated++;
              }
            }
          }
        }

        // Update last sync timestamp for this chain
        const { data: currentWallet } = await supabase
          .from('wallet_connections')
          .select('chain_last_synced_at')
          .eq('user_id', userId)
          .eq('wallet_address', walletAddress)
          .single();

        const currentSyncData = currentWallet?.chain_last_synced_at || {};
        const updatedSyncData = { ...currentSyncData, [chainId]: new Date().toISOString() };
        
        await supabase
          .from('wallet_connections')
          .update({ 
            chain_last_synced_at: updatedSyncData
          })
          .eq('user_id', userId)
          .eq('wallet_address', walletAddress);

        nextCursor = transfers.pageKey || null;

      } catch (error) {
        console.error(`Error syncing chain ${chainId}:`, error);
      }
    }

    const result: SyncWalletOutput = {
      inserted: totalInserted,
      updated: totalUpdated,
      nextCursor
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in sync-wallet-transactions:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function fetchAlchemyTransfers(address: string, chainId: number, chainConfig: any, since?: string, cursor?: string | null) {
  if (!ALCHEMY_API_KEY) {
    throw new Error('ALCHEMY_API_KEY not configured');
  }

  const baseUrl = `https://${chainConfig.alchemyNetwork}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  
  const params: any = {
    fromAddress: address,
    toAddress: address,
    category: ['external', 'erc20', 'erc721', 'erc1155'],
    maxCount: 100
  };

  if (since) {
    params.fromBlock = 'latest'; // For demo - in production, convert timestamp to block
  }
  
  if (cursor) {
    params.pageKey = cursor;
  }

  const response = await fetch(`${baseUrl}/getAssetTransfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getAssetTransfers',
      params: [params]
    })
  });

  if (!response.ok) {
    throw new Error(`Alchemy API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || { transfers: [], pageKey: null };
}

async function normalizeTransaction(transfer: any, chainId: number, chainConfig: any, userId: string) {
  try {
    // Get historical price at transaction timestamp
    const blockTime = new Date(transfer.metadata?.blockTimestamp || Date.now());
    const usdValue = await getHistoricalPrice(transfer.asset || chainConfig.nativeSymbol, blockTime, transfer.value || '0');
    const gasFeeUsd = await getHistoricalPrice(chainConfig.nativeSymbol, blockTime, transfer.metadata?.fee || '0');

    // Determine transaction direction
    const direction = transfer.from?.toLowerCase() === transfer.to?.toLowerCase() ? 'self' : 
                     (transfer.category === 'external' && transfer.to ? 'in' : 'out');

    // Determine transaction type
    const type = transfer.category === 'external' ? 'native' : 
                transfer.category?.startsWith('erc') ? transfer.category : 'other';

    return {
      user_id: userId,
      chain_id: chainId,
      network: chainConfig.name,
      transaction_hash: transfer.hash,
      log_index: transfer.logIndex || 0,
      transaction_date: blockTime.toISOString(),
      direction,
      type,
      from_address: transfer.from,
      to_address: transfer.to,
      asset_contract: transfer.rawContract?.address || null,
      asset_symbol: transfer.asset || chainConfig.nativeSymbol,
      asset_decimals: transfer.rawContract?.decimal || 18,
      amount: parseFloat(transfer.value || '0'),
      fee_native: parseFloat(transfer.metadata?.fee || '0'),
      usd_value_at_tx: usdValue,
      usd_fee_at_tx: gasFeeUsd,
      price_source: 'coingecko',
      transaction_status: 'confirmed',
      blockchain_network: chainConfig.name,
      currency: transfer.asset || chainConfig.nativeSymbol,
      wallet_address: transfer.from || transfer.to,
      transaction_type: direction === 'in' ? 'receive' : 'send',
      usd_value: usdValue,
      gas_fee_usd: gasFeeUsd,
      inserted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error normalizing transaction:', error);
    return null;
  }
}

async function getHistoricalPrice(symbol: string, timestamp: Date, amount: string): Promise<number> {
  try {
    if (!amount || parseFloat(amount) === 0) return 0;

    // For demo purposes, use current price - in production, use historical API
    const coinId = getCoinGeckoId(symbol);
    if (!coinId) return 0;

    const response = await fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=${coinId}&vs_currencies=usd`,
      { headers: { 'User-Agent': 'CryptoApp/1.0' } }
    );

    if (!response.ok) return 0;

    const data = await response.json();
    const price = data[coinId]?.usd || 0;
    
    return price * parseFloat(amount);

  } catch (error) {
    console.error('Error fetching historical price:', error);
    return 0;
  }
}

function getCoinGeckoId(symbol: string): string | null {
  const mapping: { [key: string]: string } = {
    'ETH': 'ethereum',
    'MATIC': 'matic-network',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'WETH': 'weth',
    'DAI': 'dai'
  };
  
  return mapping[symbol.toUpperCase()] || null;
}