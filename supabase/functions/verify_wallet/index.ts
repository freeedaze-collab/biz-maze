
// supabase/functions/verify-wallet/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

// EVM verification
import { isAddress as isEVMAddress, recoverMessageAddress } from 'https://esm.sh/viem@2.18.8';

// Solana verification
import nacl from 'https://esm.sh/tweetnacl@1.0.3';
import { decode as bs58Decode } from 'https://esm.sh/bs58@5.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

// --- Main Handler ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Auth & User ID ---
    const { userId } = await getUser(req);
    const adminClient = createAdminClient();

    // --- Nonce Generation (GET) ---
    if (req.method === 'GET') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      return new Response(JSON.stringify({ nonce }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- Signature Verification (POST) ---
    const body = await req.json();
    const { address, signature, message, chain, walletType } = body;

    if (!address || !signature || !message || !chain || !walletType) {
      throw new Error('address, signature, message, chain, and walletType are required.');
    }

    // --- Route to correct verification logic ---
    let isValidSignature = false;
    switch (chain.toLowerCase()) {
      case 'solana':
      case 'sol':
        isValidSignature = await verifySolanaSignature(address, signature, message);
        break;
      
      // Default to EVM for all other listed chains
      case 'ethereum':
      case 'polygon':
      case 'bnb chain':
      case 'avalanche':
      case 'arbitrum':
      case 'optimism':
      case 'base':
      case 'linea':
      case 'zksync':
        isValidSignature = await verifyEVMSignature(address, signature, message);
        break;

      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }

    if (!isValidSignature) {
      return new Response(JSON.stringify({ ok: false, error: 'Signature mismatch' }), { status: 400, headers: corsHeaders });
    }

    // --- Upsert into DB ---
    await upsertWalletConnection(adminClient, {
      userId,
      address: address.toLowerCase(), // Store addresses lowercase for consistency
      chain: chain.toLowerCase(),
      walletType: walletType.toLowerCase(),
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });

  } catch (e) {
    console.error('Function Error:', e);
    return new Response(JSON.stringify({ error: `Function error: ${e.message}` }), { status: 500, headers: corsHeaders });
  }
});

// --- Verification Logic ---

async function verifyEVMSignature(address: string, signature: `0x${string}`, message: string): Promise<boolean> {
  if (!isEVMAddress(address)) return false;
  const recoveredAddress = await recoverMessageAddress({ message, signature });
  return recoveredAddress.toLowerCase() === address.toLowerCase();
}

function verifySolanaSignature(address: string, signature: string, message: string): Promise<boolean> {
  try {
    const signatureBytes = bs58Decode(signature);
    const addressBytes = bs58Decode(address);
    const messageBytes = new TextEncoder().encode(message);
    
    // Solana uses Ed25519, so we use `nacl.sign.detached.verify`
    const isVerified = nacl.sign.detached.verify(messageBytes, signatureBytes, addressBytes);
    return Promise.resolve(isVerified);
  } catch (error) {
    console.error("Solana verification error:", error);
    return Promise.resolve(false); // If any decoding or verification fails
  }
}

// --- Database & Auth Helpers ---

function createAdminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function getUser(req: Request): Promise<{ userId: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing Authorization header');
  const jwt = authHeader.replace('Bearer ', '');
  const [, payload] = decode(jwt);
  const userId = payload?.sub;
  if (!userId) throw new Error('Could not extract user ID from token.');
  return { userId };
}

async function upsertWalletConnection(client: SupabaseClient, { userId, address, chain, walletType }: { userId: string, address: string, chain: string, walletType: string }) {
  const { error } = await client.from('wallet_connections').upsert(
    {
      user_id: userId,
      wallet_address: address,
      verified_at: new Date().toISOString(),
      verification_status: 'verified',
      wallet_type: walletType,
      chain: chain,
      wallet_name: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`, // Generic name
    },
    { onConflict: 'user_id,wallet_address' }
  );
  if (error) throw error;
}
