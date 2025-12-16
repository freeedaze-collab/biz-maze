
// supabase/functions/verify-2/index.ts
// --- DEFINITIVE FIX v2: Correcting column name from verified_at back to verified. ---
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
    // --- AUTHENTICATION: Correctly get the user from their JWT --- 
    const authHeader = req.headers.get('Authorization')!;
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User not found');

    // --- GET request: Issue a nonce --- 
    if (req.method === 'GET') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      return new Response(JSON.stringify({ nonce }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- POST request: Verify signature and link wallet ---
    if (req.method === 'POST') {
      const { address, signature, message } = await req.json();

      if (!isAddress(address) || !signature || !message) {
        throw new Error('Invalid request: address, signature, and message are required.');
      }

      const recovered = await recoverMessageAddress({ message, signature });

      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return new Response(JSON.stringify({ ok: false, error: 'Signature mismatch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // Use the SERVICE_ROLE only for admin-level writes to the DB.
      const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { error: dbError } = await adminClient.from('wallets').upsert(
        // CORRECTED: The column is named `verified`, not `verified_at`.
        { address: address.toLowerCase(), user_id: user.id, verified: true },
        { onConflict: 'user_id,address' }
      );
      if (dbError) throw dbError;

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

