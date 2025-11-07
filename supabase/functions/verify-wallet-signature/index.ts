// supabase/functions/verify-wallet-signature/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.v1';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isAddress, hashMessage, recoverAddress } from 'jsr:@wagmi/viem@2';

const STRICT = (Deno.env.get('STRICT_ADDRESS_MATCH') ?? 'true').toLowerCase() === 'true';

Deno.serve(async (req) => {
  try {
    // CORS
    const origin = req.headers.get('origin') ?? '*';
    const corsBase = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
      'vary': 'origin',
    };
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsBase });
    }

    // GET: nonce 発行
    if (req.method === 'GET') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      return new Response(JSON.stringify({ nonce }), {
        status: 200,
        headers: { 'content-type': 'application/json', ...corsBase },
      });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsBase });
    }

    // 認証（任意。必要なら ON）
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!, // or SERVICE_ROLE_KEY if保存までやる場合
      { global: { headers: { Authorization: req.headers.get('authorization')! } } }
    );
    const { data: userData } = await supabase.auth.getUser(); // ログイン必須ならチェック
    // if (!userData?.user) return new Response('Unauthorized', { status: 401, headers: corsBase });

    const { address, signature, nonce } = await req.json();
    if (typeof signature !== 'string' || typeof nonce !== 'string') {
      return new Response(JSON.stringify({ error: 'Bad request' }), {
        status: 400, headers: { 'content-type':'application/json', ...corsBase }
      });
    }

    const recovered = await recoverAddress({ hash: hashMessage(nonce), signature });

    if (STRICT) {
      if (!isAddress(address) || recovered.toLowerCase() !== String(address).toLowerCase()) {
        return new Response(JSON.stringify({
          error: 'Signature mismatch',
          recovered,
          address,
        }), { status: 400, headers: { 'content-type':'application/json', ...corsBase } });
      }
      // ここで DB upsert など
      return new Response(JSON.stringify({ ok: true, address: recovered }), {
        status: 200, headers: { 'content-type':'application/json', ...corsBase }
      });
    } else {
      // 入力 address は参考値として受け、保存は recovered を正とする
      // ここで DB upsert など
      return new Response(JSON.stringify({ ok: true, address: recovered, note: 'address overridden by recovered' }), {
        status: 200, headers: { 'content-type':'application/json', ...corsBase }
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal Error', message: String(e?.message ?? e) }), {
      status: 500,
      headers: { 'content-type':'application/json', 'access-control-allow-origin':'*' }
    });
  }
});
