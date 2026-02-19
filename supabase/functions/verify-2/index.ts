// supabase/functions/verify-2/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAddress, recoverMessageAddress } from 'https://esm.sh/viem@2.18.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};

// ============================================================
// Helper: JWTからユーザーIDを取得（decode only, 検証はSupabaseに任せる）
// ============================================================
function extractUserIdFromJwt(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const jwt = authHeader.slice('Bearer '.length);
    const payloadBase64 = jwt.split('.')[1];
    if (!payloadBase64) return null;
    // Base64URL decode
    const padded = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(padded));
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');

    // ============================================================
    // GET: nonce を発行する
    //   - 認証不要（アドレスさえあれば誰でも取得できる）
    //   - nonce はランダムUUID（DB保存なし、フロントで保持）
    // ============================================================
    if (req.method === 'GET') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      return json({ nonce });
    }

    // ============================================================
    // POST: 署名を検証してウォレットを登録する
    // ============================================================
    if (req.method !== 'POST') {
      return json({ error: 'Method Not Allowed' }, 405);
    }

    // 1) JWTからユーザーIDを取得
    const userId = extractUserIdFromJwt(authHeader);
    if (!userId) {
      return json({ ok: false, error: 'Missing or invalid Authorization token.' }, 401);
    }

    // 2) リクエストボディのパース
    let body: Record<string, string>;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }

    const { address, signature, nonce } = body;

    if (!address || !signature || !nonce) {
      return json(
        { ok: false, error: 'address, signature, nonce are all required.' },
        400
      );
    }

    if (!isAddress(address)) {
      return json({ ok: false, error: 'Invalid Ethereum address format.' }, 400);
    }

    // 3) フロントと同じメッセージを再構築して署名を検証
    //    フロント: personal_sign(message, address) でメッセージに署名
    //    ここでは同じ message から署名者アドレスを復元する
    const message = buildSignMessage(address, nonce);

    let recovered: string;
    try {
      recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
    } catch (e) {
      return json({ ok: false, error: `Signature recovery failed: ${e.message}` }, 400);
    }

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return json({ ok: false, error: 'Signature mismatch: recovered address does not match.' }, 400);
    }

    // 4) ユーザーの存在確認 + wallet_connections へ upsert
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Supabase auth.users にユーザーが存在するか確認
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return json({ ok: false, error: 'User not found in auth system.' }, 401);
    }

    const walletAddress = address.toLowerCase();
    const shortName = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;

    const { error: dbError } = await adminClient
      .from('wallet_connections')
      .upsert(
        {
          user_id: userId,
          wallet_address: walletAddress,
          verified_at: new Date().toISOString(),
          verification_status: 'verified',
          wallet_type: 'ethereum',
          chain: 'ethereum',
          wallet_name: shortName,
        },
        { onConflict: 'user_id,wallet_address' }
      );

    if (dbError) {
      console.error('[verify-2] DB upsert error:', dbError);
      return json({ ok: false, error: `Database error: ${dbError.message}` }, 500);
    }

    return json({ ok: true, address: walletAddress });

  } catch (e) {
    console.error('[verify-2] Unexpected error:', e);
    return json({ ok: false, error: `Server error: ${e?.message ?? String(e)}` }, 500);
  }
});

// ============================================================
// フロントと共有するメッセージフォーマット
// ============================================================
function buildSignMessage(address: string, nonce: string): string {
  return `Welcome to CryptoFinance!\n\nPlease sign this message to verify you own this wallet.\n\nWallet: ${address}\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas.`;
}
