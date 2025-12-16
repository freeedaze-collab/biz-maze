
// supabase/functions/verify-2/index.ts
// --- ROBUST & FINAL FIX: Handles all identified issues (auth, column name, flexible inputs) ---
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isAddress,
  recoverMessageAddress,
} from 'https://esm.sh/viem@2.18.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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
    // --- AUTHENTICATION (FIX for foreign key constraint) ---
    const authHeader = req.headers.get('Authorization')!;
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not found via token.');

    // --- GET request: Issue a nonce (Flexible) ---
    if (req.method === 'GET') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      return new Response(JSON.stringify({ nonce }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- POST request: Verify signature and link wallet (Flexible) ---
    if (req.method === 'POST') {
      const body = await req.json();
      const { address, signature } = body;
      // Flexible message field: accept 'nonce' or 'message'
      const messageToVerify = body.nonce || body.message;

      if (!isAddress(address) || !signature || !messageToVerify) {
        throw new Error('Invalid POST body: address, signature, and (nonce or message) are required.');
      }

      const recovered = await recoverMessageAddress({ message: messageToVerify, signature });

      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return new Response(JSON.stringify({ ok: false, error: 'Signature mismatch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { error: dbError } = await adminClient.from('wallets').upsert(
        // FIX for schema cache: Use `verified: true`
        { address: address.toLowerCase(), user_id: user.id, verified: true },
        { onConflict: 'user_id,address' }
      );
      if (dbError) throw dbError;

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: `Function error: ${e.message}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

