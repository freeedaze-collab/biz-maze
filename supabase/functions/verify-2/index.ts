
// supabase/functions/verify-wallet-signature/index.ts
// --- FINAL FIX v2: Correcting the onConflict parameter for the upsert ---
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isAddress,
  recoverMessageAddress,
} from 'https://esm.sh/viem@2.18.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Standard CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  // Handle preflight requests
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

    // --- Step 2: Handle GET (Nonce) vs POST (Verify) ---
    if (req.method === 'GET') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      return new Response(JSON.stringify({ nonce }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    // --- Step 3: Verify Wallet Signature ---
    const { address, signature, message } = await req.json();

    if (!isAddress(address) || typeof signature !== 'string' || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const recovered = await recoverMessageAddress({ message, signature });

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return new Response(JSON.stringify({ ok: false, error: 'Signature mismatch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Step 4: Upsert Wallet with Authenticated User ID ---
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error: dbError } = await adminClient.from('wallets').upsert(
      {
        address: address.toLowerCase(),
        user_id: user.id,
        verified: true,
      },
      { onConflict: 'user_id,address' }, // <-- THE FIX IS HERE
    );

    if (dbError) {
      throw new Error(dbError.message);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
