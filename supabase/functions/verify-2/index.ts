// // import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
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
    const authHeader = req.headers.get('Authorization');
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

    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    // --- STEP 3: Verify Signature ---
    const body = await req.json();
    const address = body.address;
    const signature = body.signature;
    const messageToVerify = body.message || body.nonce;

    if (!isAddress(address) || !signature || !messageToVerify) {
      throw new Error(`Invalid POST body. address, signature, and message/nonce are required.`);
    }

    const recovered = await recoverMessageAddress({ message: messageToVerify, signature });

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return new Response(JSON.stringify({ ok: false, error: 'Signature mismatch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- STEP 4: Upsert into 'wallet_connections' table ---
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error: dbError } = await adminClient.from('wallet_connections').upsert(
      {
        user_id: userId,
        wallet_address: address.toLowerCase(),
        verified_at: new Date().toISOString(),
        verification_status: 'verified',
        wallet_type: 'ethereum',
        chain: 'ethereum',
        wallet_name: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
      },
      { onConflict: 'user_id,wallet_address' }
    );
    if (dbError) throw dbError;

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    // Check for specific foreign key error string
    if (e.message && e.message.includes('violates foreign key constraint')) {
      return new Response(JSON.stringify({ error: `Authentication error: The provided user ID does not exist. Details: ${e.message}` }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: `Function error: ${e.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

