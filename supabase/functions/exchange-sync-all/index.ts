// supabase/functions/exchange-sync-all/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// ★★★【新しい司令塔(Commander)ロジック】★★★
// フロントエンドからの入力に頼らず、ユーザーに紐づく全ての取引所の同期を開始する
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // --- ユーザー認証 ---
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) {
            console.warn('[ALL] Auth error:', userError?.message);
            return new Response(JSON.stringify({ error: 'User not found.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }

        console.log(`[ALL] Received sync request for user: ${user.id}`);

        // --- ユーザーに紐づく全てのAPIキー資格情報を取得 ---
        const { data: credentials, error: credsError } = await supabaseAdmin
            .from('exchange_api_credentials')
            .select('id, exchange')
            .eq('user_id', user.id);

        if (credsError) throw new Error(`Failed to fetch credentials: ${credsError.message}`);

        if (!credentials || credentials.length === 0) {
            console.log(`[ALL] No credentials found for user ${user.id}. Nothing to do.`);
            return new Response(JSON.stringify({ message: "No exchange connections found." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[ALL] Found ${credentials.length} credentials. Invoking workers...`);

        // --- 全ての資格情報に対して、'trades' と 'transfers' の同期タスクを非同期で開始 ---
        const tasks = [];
        for (const cred of credentials) {
            console.log(`[ALL] -> Invoking 'trades' and 'transfers' sync for ${cred.exchange} (cred_id: ${cred.id})`);
            tasks.push(supabaseAdmin.functions.invoke("exchange-sync-worker", { 
                body: { credential_id: cred.id, exchange: cred.exchange, task_type: 'trades' }
            }));
            tasks.push(supabaseAdmin.functions.invoke("exchange-sync-worker", { 
                body: { credential_id: cred.id, exchange: cred.exchange, task_type: 'transfers' }
            }));
        }
        
        // 非同期で実行し、全ての結果を待つ（必要に応じて）
        await Promise.all(tasks);

        const successMessage = `Successfully triggered sync for ${credentials.length} exchange(s).`;
        console.log(`[ALL] ${successMessage}`);

        return new Response(JSON.stringify({ message: successMessage }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error(`[ALL CRASH] A critical error occurred:`, err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 
        });
    }
});
