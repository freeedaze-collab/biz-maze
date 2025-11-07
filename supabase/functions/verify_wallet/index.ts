// supabase/functions/verify-wallet-signature/index.ts
// --- 完全差し替え用（personal_sign と厳密一致） ---
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isAddress,
  recoverMessageAddress, // ★ personal_sign 用の正解API
} from 'https://esm.sh/viem@2.18.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// CORS許可（Lovable preview など外部から叩けるように）
const ALLOW_ORIGIN = '*';

function cors(res: Response) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  h.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  h.set('Access-Control-Allow-Headers', 'authorization,content-type');
  return new Response(res.body, { status: res.status, headers: h });
}

Deno.serve(async (req) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return cors(new Response(null, { status: 204 }));
  }

  // GET: ノンス払い出し（プレーン文字列）
  if (req.method === 'GET') {
    const nonce = crypto.randomUUID().replace(/-/g, '');
    return cors(
      new Response(JSON.stringify({ nonce }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }

  // POST 以外は拒否
  if (req.method !== 'POST') {
    return cors(new Response('Method Not Allowed', { status: 405 }));
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return cors(
      new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }

  const { action, address, signature, nonce } = body ?? {};
  if (action !== 'verify') {
    return cors(
      new Response(JSON.stringify({ error: 'Bad request (action)' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }

  // 入力バリデーション
  if (!isAddress(address) || typeof signature !== 'string' || typeof nonce !== 'string') {
    return cors(
      new Response(JSON.stringify({ error: 'Bad request (params)' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }

  try {
    // ★ personal_sign の復号は「メッセージそのもの」から行う
    const recovered = await recoverMessageAddress({ message: nonce, signature });

    // デバッグログ（Supabase Logs に出ます）
    console.info(
      `verify {\n  input: "${address.toLowerCase()}",\n  recovered: "${recovered}",\n  nonce8: "${nonce.slice(
        0,
        8,
      )}",\n  sigLen: ${signature.length}\n}\n`,
    );

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return cors(
        new Response(
          JSON.stringify({ error: 'Signature mismatch', recovered, address }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      );
    }

    // ここでDB更新（例：wallets upsert）
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error } = await admin.from('wallets').upsert(
      {
        address: address.toLowerCase(),
        user_id: (await admin.auth.getUser()).data.user?.id ?? null,
        verified: true,
      },
      { onConflict: 'address' },
    );
    if (error) {
      return cors(
        new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }

    return cors(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  } catch (e) {
    return cors(
      new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }
});
