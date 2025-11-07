// supabase/functions/verify-wallet-signature/index.ts
// Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isAddress,
  hashMessage,        // ← EIP-191 前置き込みのハッシュ
  recoverAddress,     // ← これで復元
} from 'https://esm.sh/viem@2';

const cors = {
  'Access-Control-Allow-Origin': '*', // 必要なら preview--biz-maze.lovable.app を明示
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  // 0) CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // 1) nonce を配布（プレーン文字列）
  if (req.method === 'GET') {
    const nonce = crypto.randomUUID().replace(/-/g, '');
    return new Response(JSON.stringify({ nonce }), {
      status: 200, headers: { 'content-type': 'application/json', ...cors },
    });
  }

  // 2) 署名検証
  if (req.method === 'POST') {
    try {
      const { address, signature, nonce } = await req.json();

      if (!isAddress(address) || typeof signature !== 'string' || typeof nonce !== 'string') {
        return new Response(JSON.stringify({ error: 'Bad request' }), {
          status: 400, headers: { 'content-type': 'application/json', ...cors },
        });
      }

      // ★ EIP-191：メッセージ（= nonce）に前置きを付けたハッシュで recover
      const hash = hashMessage(nonce);
      const recovered = await recoverAddress({ hash, signature });

      // ログ（短縮表示）
      console.log('verify', {
        input: address, recovered,
        nonce8: nonce.slice(0, 8),
        sigLen: signature.length,
      });

      if (recovered.toLowerCase() !== address.toLowerCase()) {
        return new Response(JSON.stringify({ error: 'Signature mismatch', recovered }), {
          status: 400, headers: { 'content-type': 'application/json', ...cors },
        });
      }

      // ここで DB 登録など（必要なら）
      // await supabase.from('wallets').upsert({ user_id, address, verified: true })

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'content-type': 'application/json', ...cors },
      });
    } catch (e) {
      console.error('fatal', e);
      // null body で 500 を返すと Deno 側がこけるため JSON を必ず返す
      return new Response(JSON.stringify({ error: 'Internal Error' }), {
        status: 500, headers: { 'content-type': 'application/json', ...cors },
      });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: cors });
});
