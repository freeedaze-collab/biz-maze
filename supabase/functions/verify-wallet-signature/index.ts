// Supabase Edge Function (Deno): verify-wallet-signature
// 最小実装：メッセージ署名の真偽を検証（本番は SIWE + nonce を推奨）
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as viem from 'npm:viem';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

type Req = {
  address: `0x${string}`;
  message: string;
  signature: `0x${string}`;
  userId: string;
};

serve(async (req) => {
  try {
    const { address, message, signature, userId } = (await req.json()) as Req;

    if (!address || !message || !signature || !userId) {
      return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
    }

    // NOTE: SIWE を使う場合は、ここで nonce チェックやドメイン/期限検証を追加してください
    const ok = await viem.verifyMessage({ address, message, signature });
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
    }

    const { error } = await supabase
      .from('wallet_connections')
      .upsert(
        { user_id: userId, address, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,address' }
      );
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, address, userId }), { status: 200 });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error)?.message ?? 'Internal error' }),
      { status: 500 },
    );
  }
});
