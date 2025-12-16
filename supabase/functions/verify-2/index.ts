
// supabase/functions/verify-2/index.ts
// --- FINAL VERSION: Dynamically accepts `wallet_type` from the client. ---
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';
import {
  isAddress,
  recoverMessageAddress,
} from 'https://esm.sh/viem@2.18.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- STEP 1: Get User ID directly from JWT --- 
    const authHeader = req.headers.get('Authorization')!;
    if (!authHeader) throw new Error('Missing Authorization header');
    const jwt = authHeader.replace('Bearer ', '');
    const [, payload] = decode(jwt);
    const userId = payload?.sub;
    if (!userId) throw new Error('Could not extract user ID from token.');

    // --- STEP 2: Handle GET (Nonce) vs POST (Verify) ---
    if (req.method === 'GET') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      return new Response(JSON.stringify({ nonce }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const wallet_address = body.address;
      const { signature, wallet_type } = body; // `wallet_type` をbodyから取得
      const messageToVerify = body.message || body.nonce;

      // `wallet_type` の存在チェックを追加
      if (!isAddress(wallet_address) || !signature || !messageToVerify || !wallet_type) {
        throw new Error('Invalid POST body: address, signature, nonce, and wallet_type are required.');
      }

      const recovered = await recoverMessageAddress({ message: messageToVerify, signature });

      if (recovered.toLowerCase() !== wallet_address.toLowerCase()) {
        return new Response(JSON.stringify({ ok: false, error: 'Signature mismatch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // --- STEP 3: Upsert with the DYNAMIC wallet_type ---
      const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { error: dbError } = await adminClient.from('wallet_connections').upsert(
        {
          user_id: userId,
          wallet_address: wallet_address.toLowerCase(),
          verified_at: new Date().toISOString(),
          verification_status: 'verified',
          wallet_type: wallet_type // 受け取った`wallet_type`を使用
        },
        { onConflict: 'user_id,wallet_address' }
      );
      if (dbError) throw dbError;

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: `Function error: ${e.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

