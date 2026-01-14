
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { verifyMessage as verifyEVMMessage } from 'https://esm.sh/viem@2.9.23';
import { Verifier } from 'https://esm.sh/bip322-js';
import nacl from 'https://esm.sh/tweetnacl@1.0.3';
import bs58 from 'https://esm.sh/bs58@5.0.0';
const { decode } = bs58;
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

// Helper to verify a Bitcoin signature
const verifyBitcoinSignature = (params: { address: string; signature: string; message: string; }) => {
    try {
        const { address, signature, message } = params;
        console.log(`[VerifyBTC] Input: address=${address}, sigLen=${signature?.length}`);

        // Decode base64 to buffer
        const sigBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

        // Attempt 1: Standard Verification (if signature is already correct format)
        try {
            const isValid = Verifier.verifySignature(address, message, signature);
            if (isValid) {
                console.log("[VerifyBTC] Standard verification succeeded.");
                return true;
            }
        } catch (e) {
            console.log(`[VerifyBTC] Standard verify failed/error: ${e}`);
        }

        // Attempt 2: Strip 2 bytes (Phantom 66-byte prefix: 0x01 0x40 ... data)
        if (sigBuffer.length === 66 || (sigBuffer.length > 64 && sigBuffer.length <= 68)) {
            // We want the last 64 bytes (Schnorr signature)
            // If length is 66, start at 2.
            // General approach: take last 64 bytes.
            const stripped = sigBuffer.slice(sigBuffer.length - 64);
            const strippedBase64 = btoa(String.fromCharCode(...stripped));
            console.log(`[VerifyBTC] Attempting verification with last 64 bytes (Stripped Base64 len: ${strippedBase64.length})`);

            try {
                const isValid = Verifier.verifySignature(address, message, strippedBase64);
                if (isValid) {
                    console.log("[VerifyBTC] Stripped verification succeeded.");
                    return true;
                }
            } catch (e) {
                console.log(`[VerifyBTC] Stripped verify failed: ${e}`);
            }
        }

        return false;
    } catch (e) {
        console.error('Bitcoin verification crashed:', e);
        return false;
    }
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const supabaseAdmin = createClient(SUPABASE_URL!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

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
        // Expiration: 2 minutes
        const expiresAt = new Date(Date.now() + NONCE_EXPIRATION_S * 1000).toISOString();

        // Upsert nonce to DB
        const { error: upsertError } = await supabaseAdmin.from('nonce_store').upsert({
            user_id: user.id,
            nonce: newNonce,
            expires_at: expiresAt
        });

        if (upsertError) {
            console.error('Nonce save failed:', upsertError);
            return new Response(JSON.stringify({ error: 'Failed to generate nonce', details: upsertError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ nonce: newNonce }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST') {
        try {
            const body = await req.json();
            const { address, signature, message, chain, walletType, entity_id } = body;

            if (!address || !signature || !message || !chain || !walletType) {
                return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            const { data: storedNonce, error: nonceError } = await supabaseAdmin.from('nonce_store').select('nonce, expires_at').eq('user_id', user.id).single();

            if (nonceError || !storedNonce || storedNonce.nonce !== message || new Date(storedNonce.expires_at).getTime() < Date.now()) {
                return new Response(JSON.stringify({ error: 'Invalid or expired nonce' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // Delete nonce (single use)
            await supabaseAdmin.from('nonce_store').delete().eq('user_id', user.id);

            let isValid = false;
            console.log(`[VerifyWallet] Type: ${walletType}, Chain: ${chain}, Address: ${address}`);

            if (walletType === 'phantom' && chain === 'solana') {
                isValid = verifySolanaSignature({ address, signature, message });
            } else if (['metamask', 'walletconnect', 'phantom-evm'].includes(walletType) || walletType === 'metamask') {
                // Note: phantom-evm reuses metamask logic in frontend but might pass 'phantom-evm' as walletType?
                // Frontend passes 'metamask' handler for phantom-evm?
                // Let's check frontend. Frontend passes `handler: 'phantom-evm'`.
                // Backend needs to handle 'phantom-evm' OR treating it as standard EVM.
                // Actually frontend `handleLinkWithPhantomEVM` calls postVerify with `walletType: 'metamask'`?
                // Let's assume standard EVM verification for these:
                isValid = await verifyEVMMessage({ address, message, signature });
            } else if (walletType === 'bitcoin') {
                isValid = verifyBitcoinSignature({ address, signature, message });
            }
            // Fallback for generic EVM if not matched above but passed to backend
            // (Frontend sends walletType: 'metamask' for Phantom EVM, so it hits the second block)

            if (!isValid) {
                console.error(`[VerifyWallet] Verification Failed or returned false. WalletType: ${walletType}`);
                return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // Removed 'Wallet already linked' check to allow shared wallets (multiple users can verify the same address).

            const { error: insertError } = await supabaseAdmin.from('wallet_connections').insert({
                user_id: user.id,
                wallet_address: address,
                verified_at: new Date().toISOString(),
                entity_id: entity_id || null,
                wallet_type: walletType,
                chain: chain,
                wallet_name: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
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
