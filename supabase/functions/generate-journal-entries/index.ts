// supabase/functions/generate-journal-entries/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
// --- CORS ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey'
};
const json = (obj, init = {})=>new Response(JSON.stringify(obj, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders
    },
    ...init
  });
Deno.serve(async (req)=>{
  // 到達ログ（呼ばれているかの一次判定）
  console.log('[generate-journal-entries] received', {
    method: req.method,
    url: req.url,
    hasAuth: !!req.headers.get('Authorization')
  });
  if (req.method === 'OPTIONS') {
    console.log('[generate-journal-entries] preflight');
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') ?? ''
        }
      }
    });
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      console.warn('[generate-journal-entries] unauthorized');
      return json({
        ok: false,
        error: 'unauthorized'
      }, {
        status: 401
      });
    }
    const userId = auth.user.id;
    console.log('[generate-journal-entries] user', userId);
    // 取引取得
    const { data: txs, error: txErr } = await supabase.from('wallet_transactions').select('id, user_id, direction, tx_hash, occurred_at, fiat_value_usd').eq('user_id', userId).order('occurred_at', {
      ascending: false
    }).limit(1000);
    if (txErr) throw txErr;
    console.log('[generate-journal-entries] fetched txs', txs?.length ?? 0);
    // 既存仕訳の tx_id を取得
    const { data: existing, error: exErr } = await supabase.from('journal_entries').select('tx_id').eq('user_id', userId).not('tx_id', 'is', null).limit(5000);
    if (exErr) throw exErr;
    const done = new Set((existing ?? []).map((r)=>r.tx_id));
    console.log('[generate-journal-entries] existing mapped', done.size);
    // 診断用カウンタ
    let skippedDuplicate = 0;
    let skippedMissing = 0;
    const rows = [];
    for (const t of txs ?? []){
      if (!t?.id) {
        skippedMissing++;
        continue;
      }
      if (done.has(t.id)) {
        skippedDuplicate++;
        continue;
      }
      const amt = Number(t?.fiat_value_usd ?? 0);
      const occurred = t?.occurred_at;
      const direction = String(t?.direction ?? '').toLowerCase();
      if (!Number.isFinite(amt) || amt === 0 || !occurred || direction !== 'in' && direction !== 'out') {
        skippedMissing++;
        continue;
      }
      const entryDate = occurred.slice(0, 10);
      if (direction === 'in') {
        rows.push({
          user_id: userId,
          tx_id: t.id,
          entry_date: entryDate,
          account: 'CryptoAssets',
          dc: 'D',
          amount: amt
        });
        rows.push({
          user_id: userId,
          tx_id: t.id,
          entry_date: entryDate,
          account: 'OtherIncome',
          dc: 'C',
          amount: amt
        });
      } else {
        rows.push({
          user_id: userId,
          tx_id: t.id,
          entry_date: entryDate,
          account: 'OperatingExpense',
          dc: 'D',
          amount: amt
        });
        rows.push({
          user_id: userId,
          tx_id: t.id,
          entry_date: entryDate,
          account: 'CryptoAssets',
          dc: 'C',
          amount: amt
        });
      }
    }
    console.log('[generate-journal-entries] to insert rows', rows.length, {
      skippedDuplicate,
      skippedMissing
    });
    let inserted = 0;
    while(rows.length){
      const chunk = rows.splice(0, 500);
      if (chunk.length === 0) break;
      const { error: insErr } = await supabase.from('journal_entries').insert(chunk);
      if (insErr) throw insErr;
      inserted += chunk.length;
    }
    const result = {
      ok: true,
      inserted,
      skippedDuplicate,
      skippedMissing,
      totalTxs: txs?.length ?? 0
    };
    console.log('[generate-journal-entries] result', result);
    return json(result);
  } catch (e) {
    console.error('[generate-journal-entries] ERROR', e);
    return json({
      ok: false,
      error: String(e?.message || e)
    }, {
      status: 500
    });
  }
});
