
// supabase/functions/verify_wallet/index.ts
// --- FIX: This version correctly handles user authentication ---
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isAddress,
  recoverMessageAddress,
} from 'https://esm.sh/viem@2.18.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOW_ORIGIN = '*';

function cors(res: Response) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  h.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  h.set('Access-Control-Allow-Headers', 'authorization,content-type');
  return new Response(res.body, { status: res.status, headers: h });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return cors(new Response(null, { status: 204 }));
  }

  // --- ★ FIX START: Handle user authentication correctly ---
  let user: any = null;
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return cors(new Response(JSON.stringify({ error: 'Missing auth token' }), { status: 401 }));
    }
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) {
      return cors(new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 }));
    }
    user = data.user;
  } catch (e) {
    return cors(new Response(JSON.stringify({ error: 'Auth error: ' + e.message }), { status: 500 }));
  }
  // --- ★ FIX END ---

  if (req.method === 'GET') {
    const nonce = crypto.randomUUID().replace(/-/g, '');
    return cors(new Response(JSON.stringify({ nonce }), { status: 200, headers: { 'content-type': 'application/json' } }));
  }

  if (req.method !== 'POST') {
    return cors(new Response('Method Not Allowed', { status: 405 }));
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return cors(new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'content-type': 'application/json' } }));
  }

  const { action, address, signature, message: nonce } = body ?? {}; // client sends `message`, we call it `nonce`
  if (action !== 'verify') {
    return cors(new Response(JSON.stringify({ error: 'Bad request (action)' }), { status: 400, headers: { 'content-type': 'application/json' } }));
  }

  if (!isAddress(address) || typeof signature !== 'string' || typeof nonce !== 'string') {
    return cors(new Response(JSON.stringify({ error: 'Bad request (params)' }), { status: 400, headers: { 'content-type': 'application/json' } }));
  }

  try {
    const recovered = await recoverMessageAddress({ message: nonce, signature });

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return cors(new Response(JSON.stringify({ error: 'Signature mismatch', recovered, address }), { status: 400, headers: { 'content-type': 'application/json' } }));
    }

    // ★ FIX: Use the authenticated user.id for the database operation
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error: dbError } = await admin.from('wallets').upsert(
      {
        address: address.toLowerCase(),
        user_id: user.id, // Now this is a valid UUID
        verified: true,
      },
      { onConflict: 'address' },
    );

    if (dbError) {
       console.error('Database error:', dbError.message);
       return cors(new Response(JSON.stringify({ ok: false, error: dbError.message }), { status: 500 }));
    }

    return cors(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
  } catch (e) {
    console.error('Unexpected error:', e.message);
    return cors(new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'content-type': 'application/json' } }));
  }
});
