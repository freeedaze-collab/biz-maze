// ---------- 保存（簡易版：1件ずつ upsert） ----------
async function saveTrades(
  supabase: any,
  userId: string,
  exchange: string,
  external_user_id: string | null,
  items: any[]
) {
  for (const it of items) {
    const payload = {
      user_id: userId,
      exchange,
      external_user_id,
      trade_id: String(it.trade_id),
      ts: new Date(it.ts).toISOString(),
      symbol: it.symbol,
      side: it.side,
      qty: it.qty ?? null,
      price: it.price ?? null,
      fee: it.fee ?? null,
      fee_asset: it.fee_asset ?? null,
      raw: it,
    };
    await supabase
      .from("exchange_trades")
      .upsert(payload, {
        onConflict: "user_id,exchange,external_user_id,trade_id",
      });
  }
}
