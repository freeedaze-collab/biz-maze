
// supabase/functions/verify-2/index.ts
// --- FINAL FIX v4: Making the function compatible with BOTH old and new wallet verification flows ---
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isAddress,
  recoverMessageAddress,
} from 'https://esm.sh/viem@2.18.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Step 1: Enforce User Authentication ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: userError ? userError.message : 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();

    // --- Step 2A: Handle Nonce Request (New Flow) ---
    if (body.action === 'nonce') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      return new Response(JSON.stringify({ nonce }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Step 2B: Handle Verification (Both Flows) ---
    let address, signature, messageToVerify;

    // Check which flow we're in based on the presence of 'action' vs 'message'
    if (body.action === 'verify') {
      // New flow (from useSIWE.tsx or Wallets.tsx)
      address = body.address;
      signature = body.signature;
      messageToVerify = body.nonce; // The nonce is the message
    } else if (body.message) {
      // Legacy flow (from useWallet.tsx)
      address = body.address;
      signature = body.signature;
      messageToVerify = body.message;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid request body. Must contain either `action: \'verify\'` and `nonce`, or a `message`.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Step 3: Verify Wallet Signature (Unified) ---
    if (!isAddress(address) || typeof signature !== 'string' || typeof messageToVerify !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid parameters for verification' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const recovered = await recoverMessageAddress({ message: messageToVerify, signature });

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return new Response(JSON.stringify({ ok: false, error: 'Signature mismatch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Step 4: Upsert Wallet with Authenticated User ID (Unified) ---
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error: dbError } = await adminClient.from('wallets').upsert(
      {
        address: address.toLowerCase(),
        user_id: user.id,
        verified: true,
      },
      { onConflict: 'user_id,address' },
    );

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
