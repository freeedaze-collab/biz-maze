import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      userId,
      recipientAddress, 
      amount, 
      currency, 
      walletAddress,
      invoiceId,
      description 
    } = await req.json();

    console.log(`Processing crypto payment: ${amount} ${currency} to ${recipientAddress}`);

    // Validate wallet ownership
    const { data: wallet, error: walletError } = await supabase
      .from('wallet_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('wallet_address', walletAddress)
      .single();

    if (walletError || !wallet) {
      throw new Error('Wallet not found or not owned by user');
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('crypto_payments')
      .insert({
        user_id: userId,
        invoice_id: invoiceId,
        recipient_address: recipientAddress,
        amount: parseFloat(amount),
        currency,
        wallet_address: walletAddress,
        description,
        payment_status: 'processing'
      })
      .select()
      .single();

    if (paymentError) {
      throw paymentError;
    }

    // Mock transaction processing - in real implementation:
    // 1. Call Web3 provider (MetaMask, WalletConnect, etc.)
    // 2. Sign and broadcast transaction
    // 3. Monitor transaction status
    
    // Simulate transaction processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    const mockGasFee = 0.001; // ETH
    const mockGasFeeUsd = mockGasFee * 2500; // Approximate ETH price

    // Update payment with transaction details
    const { error: updateError } = await supabase
      .from('crypto_payments')
      .update({
        transaction_hash: mockTxHash,
        gas_fee: mockGasFee,
        payment_status: 'completed'
      })
      .eq('id', payment.id);

    if (updateError) {
      throw updateError;
    }

    // Record transaction in history
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        wallet_address: walletAddress,
        transaction_hash: mockTxHash,
        transaction_type: 'send',
        amount: parseFloat(amount),
        currency,
        usd_value: parseFloat(amount) * (currency === 'ETH' ? 2500 : 1), // Mock USD conversion
        from_address: walletAddress,
        to_address: recipientAddress,
        gas_fee: mockGasFee,
        gas_fee_usd: mockGasFeeUsd,
        blockchain_network: 'ethereum',
        transaction_date: new Date().toISOString(),
        transaction_status: 'confirmed'
      });

    if (txError) {
      console.error('Error recording transaction:', txError);
    }

    console.log(`Payment completed with transaction hash: ${mockTxHash}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transactionHash: mockTxHash,
        paymentId: payment.id,
        gasFeePaid: mockGasFeeUsd
      }),
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