
// supabase/functions/verify-wallet/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { verifyMessage as verifyEVMMessage } from 'https://esm.sh/viem@2.9.23';
import nacl from 'https://esm.sh/tweetnacl@1.0.3';
import { decode } from 'https://esm.sh/bs58@5.0.0';
import { corsHeaders } from '../_shared/cors.ts';

const NONCE_EXPIRATION_S = 120; // A nonce is valid for 2 minutes
const FN_SECRET = Deno.env.get('FN_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

// A simple in-memory nonce store (replace with a scalable solution like Redis in production)
const nonceStore = new Map<string, { nonce: string, expires: number }>();

// Helper to generate a secure random nonce
const generateNonce = () => {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Helper to verify a Solana signature
const verifySolanaSignature = (params: { address: string; signature: string; message: string; }) => {
    const { address, signature, message } = params;
    const messageBytes = new TextEncoder().encode(message);
    const publicKeyBytes = decode(address);
    const signatureBytes = decode(signature);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}` } }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'GET') {
        const newNonce = generateNonce();
        const expires = Date.now() + NONCE_EXPIRATION_S * 1000;
        nonceStore.set(user.id, { nonce: newNonce, expires });

        // Clean up expired nonces (simple garbage collection)
        for (const [key, value] of nonceStore.entries()) {
            if (value.expires < Date.now()) {
                nonceStore.delete(key);
            }
        }

        return new Response(JSON.stringify({ nonce: newNonce }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST') {
        try {
            const body = await req.json();
            const { address, signature, message, chain, walletType } = body;

            if (!address || !signature || !message || !chain || !walletType) {
                return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            const storedNonce = nonceStore.get(user.id);
            if (!storedNonce || storedNonce.nonce !== message || storedNonce.expires < Date.now()) {
                return new Response(JSON.stringify({ error: 'Invalid or expired nonce' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            nonceStore.delete(user.id); // Nonce is single-use

            let isValid = false;
            if (walletType === 'phantom' && chain === 'solana') {
                isValid = verifySolanaSignature({ address, signature, message });
            } else if (['metamask', 'walletconnect'].includes(walletType)) {
                isValid = await verifyEVMMessage({ address, message, signature });
            }

            if (!isValid) {
                return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            const { data: existing, error: selectError } = await supabaseAdmin.from('wallet_connections').select('id').eq('wallet_address', address).single();
            if (selectError && selectError.code !== 'PGRST116') throw selectError; // Ignore 'not found' errors
            if (existing) {
                return new Response(JSON.stringify({ error: 'Wallet already linked by another user' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            const { error: insertError } = await supabaseAdmin.from('wallet_connections').insert({
                user_id: user.id,
                wallet_address: address,
                verified_at: new Date().toISOString(),
            });
            if (insertError) throw insertError;

            return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } catch (e) {
            console.error('Verification Error:', e);
            return new Response(JSON.stringify({ error: 'Server Error', details: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
});
