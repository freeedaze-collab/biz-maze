import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALCHEMY_API_KEY = Deno.env.get('ALCHEMY_API_KEY');

interface SendPaymentInput {
  userId: string;
  chainId: number;
  to: string;
  asset: { 
    type: 'native' | 'erc20'; 
    contract?: string; 
    symbol: string; 
    decimals: number 
  };
  amount: string; // human readable
}

interface SendPaymentOutput {
  txRequest: any; // viem compatible request object with gas params
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const input: SendPaymentInput = await req.json();
    const { userId, chainId, to, asset, amount } = input;

    console.log('Preparing crypto payment:', { userId, chainId, to, asset, amount });

    // Validate recipient address (basic EIP-55 check)
    if (!to.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('Invalid recipient address format');
    }

    // Validate amount
    if (parseFloat(amount) <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Get gas estimates from Alchemy
    const gasEstimate = await estimateGas(chainId, to, asset, amount);
    
    // Prepare transaction request object for client signing
    const txRequest = {
      to,
      value: asset.type === 'native' ? parseHexAmount(amount, asset.decimals) : '0x0',
      data: asset.type === 'erc20' ? encodeERC20Transfer(to, amount, asset.decimals) : '0x',
      gas: gasEstimate.gasLimit,
      maxFeePerGas: gasEstimate.maxFeePerGas,
      maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas,
      chainId
    };

    // Create pending payment record for tracking
    const { data: payment, error: paymentError } = await supabase
      .from('crypto_payments')
      .insert({
        user_id: userId,
        recipient_address: to,
        amount: parseFloat(amount),
        currency: asset.symbol,
        payment_status: 'pending',
        gas_fee: parseFloat(gasEstimate.totalGasCost),
        usd_amount: parseFloat(amount) * 3000 // Mock USD conversion
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
    }

    const result: SendPaymentOutput = { txRequest };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-crypto-payment:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function estimateGas(chainId: number, to: string, asset: any, amount: string) {
  if (!ALCHEMY_API_KEY) {
    // Return mock gas estimates if Alchemy not configured
    return {
      gasLimit: '0x5208', // 21000 for simple transfer
      maxFeePerGas: '0x2540be400', // 10 gwei
      maxPriorityFeePerGas: '0x77359400', // 2 gwei
      totalGasCost: '0.0002'
    };
  }

  try {
    const networkMap: { [key: number]: string } = {
      1: 'eth-mainnet',
      137: 'polygon-mainnet'
    };

    const network = networkMap[chainId];
    if (!network) throw new Error(`Unsupported chain ID: ${chainId}`);

    const alchemyUrl = `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    
    // Get gas price
    const gasPriceResponse = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_gasPrice',
        params: []
      })
    });

    const gasPriceData = await gasPriceResponse.json();
    const gasPrice = gasPriceData.result || '0x2540be400';

    return {
      gasLimit: asset.type === 'native' ? '0x5208' : '0xa4cb', // 21000 for ETH, 42187 for ERC20
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: '0x77359400', // 2 gwei
      totalGasCost: (parseInt(gasPrice, 16) * (asset.type === 'native' ? 21000 : 42187) / 1e18).toString()
    };

  } catch (error) {
    console.error('Error estimating gas:', error);
    // Return safe defaults
    return {
      gasLimit: asset.type === 'native' ? '0x5208' : '0xa4cb',
      maxFeePerGas: '0x2540be400',
      maxPriorityFeePerGas: '0x77359400',
      totalGasCost: '0.0002'
    };
  }
}

function parseHexAmount(amount: string, decimals: number): string {
  const value = parseFloat(amount) * Math.pow(10, decimals);
  return '0x' + Math.floor(value).toString(16);
}

function encodeERC20Transfer(to: string, amount: string, decimals: number): string {
  // ERC20 transfer function signature: transfer(address,uint256)
  const methodId = '0xa9059cbb';
  const paddedTo = to.slice(2).padStart(64, '0');
  const amountHex = parseHexAmount(amount, decimals).slice(2).padStart(64, '0');
  return methodId + paddedTo + amountHex;
}