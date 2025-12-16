
// supabase/functions/verify-2/index.ts
// --- FINAL FIX v5: Using GET for nonce, POST for verify to resolve JSON parsing issue ---
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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Allow GET for nonce
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Handle GET requests for nonce ---
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');

      if (action === 'nonce') {
        // User authentication is still required to get a nonce
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header for nonce' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const nonce = crypto.randomUUID().replace(/-/g, '');
        return new Response(JSON.stringify({ nonce }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else {
        return new Response(JSON.stringify({ error: 'Invalid GET action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // --- Handle POST requests for verification ---
    if (req.method === 'POST') {
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

        let address, signature, messageToVerify;

        if (body.action === 'verify') { // New flow
            address = body.address;
            signature = body.signature;
            messageToVerify = body.nonce;
        } else if (body.message) { // Legacy flow
            address = body.address;
            signature = body.signature;
            messageToVerify = body.message;
        } else {
            return new Response(JSON.stringify({ error: 'Invalid POST body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (!isAddress(address) || typeof signature !== 'string' || typeof messageToVerify !== 'string') {
            return new Response(JSON.stringify({ error: 'Invalid parameters for verification' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const recovered = await recoverMessageAddress({ message: messageToVerify, signature });

        if (recovered.toLowerCase() !== address.toLowerCase()) {
            return new Response(JSON.stringify({ ok: false, error: 'Signature mismatch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { error: dbError } = await adminClient.from('wallets').upsert(
            { address: address.toLowerCase(), user_id: user.id, verified: true },
            { onConflict: 'user_id,address' },
        );

        if (dbError) {
            throw new Error(`Database error: ${dbError.message}`);
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Handle other methods ---
    return new Response(JSON.stringify({ error: `Method ${req.method} not allowed.` }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    // Catch JSON parsing errors specifically for POST
    if (e instanceof SyntaxError) {
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

