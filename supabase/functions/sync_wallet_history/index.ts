// supabase/functions/sync_wallet_history/index.ts
// 連携済みウォレット(primary_wallet)のチェーン履歴を Alchemy から取得 → 保存/更新
// - サイト外トランザクションも拾う
// - 既存 record_transfer 等はそのまま（追加機能）

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { svc, authClient, json, bad } from "../_shared/supabase.ts";

const ALCHEMY_URL = Deno.env.get("ALCHEMY_API_URL"); // 例: https://eth-mainnet.g.alchemy.com/v2/<KEY>
if (!ALCHEMY_URL) {
  console.warn("[sync_wallet_history] Missing ALCHEMY_API_URL secret");
}

type AlchemyTransfer = {
  blockNum: string;         // hex
  hash: string;
  from: string;
  to: string | null;
  value?: string;           // ネイティブの時は "0.0123" (ETH)
  asset?: string;           // "ETH" / "USDC" etc
  category: "external" | "internal" | "erc20" | "erc721" | "erc1155";
  rawContract?: { value?: string };
  metadata?: { blockTimestamp?: string };
};

async function fetchTransfers(direction: "in" | "out", address: string, fromBlockHex: string) {
  if (!ALCHEMY_URL) throw new Error("ALCHEMY_API_URL not set");
  const params: any = {
    fromBlock: fromBlockHex,
    withMetadata: true,
    excludeZeroValue: false,
    maxCount: "0x64", // 100
    category: ["external", "internal", "erc20", "erc721", "erc1155"],
  };
  if (direction === "in") params.toAddress = address;
  if (direction === "out") params.fromAddress = address;

  const results: AlchemyTransfer[] = [];
  let pageKey: string | undefined = undefined;

  do {
    const body = {
      id: 1,
      jsonrpc: "2.0",
      method: "alchemy_getAssetTransfers",
      params: [{ ...params, pageKey }],
    };
    const r = await fetch(ALCHEMY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Alchemy HTTP ${r.status}`);
    const j = await r.json();
    const res = j?.result;
    if (res?.transfers?.length) {
      results.push(...res.transfers);
    }
    pageKey = res?.pageKey;
  } while (pageKey);

  return results;
}

function hexToBigint(hex: string | null | undefined): bigint | null {
  if (!hex) return null;
  try {
    return BigInt(hex);
  } catch {
    return null;
  }
}

function toWeiString(nativeValue?: string, rawValue?: string): string | null {
  // nativeValue: "0.0123" (ETH) のことが多い。なければ rawContract.value をそのまま保存。
  if (nativeValue && /^[0-9.]+$/.test(nativeValue)) {
    // 小数→wei は失敗しやすいので桁をずらす簡易変換（整数精度でOK）
    // ここでは情報保持目的なので厳密でなくても可。raw にも保存する。
    const [intp, fracp = ""] = nativeValue.split(".");
    const wei = BigInt(intp + (fracp + "0".repeat(18)).slice(0, 18));
    return wei.toString();
  }
  if (rawValue && /^0x[0-9a-fA-F]+$/.test(rawValue)) {
    try { return BigInt(rawValue).toString(); } catch { /* ignore */ }
  }
  return null;
}

serve(async (req) => {
  const supaUser = authClient(req);
  const { data: { user } } = await supaUser.auth.getUser();
  if (!user) return bad("Not authenticated", 401);

  try {
    const s = svc();

    // profiles から primary_wallet を取得
    const { data: prof, error: pe } = await s
      .from("profiles")
      .select("primary_wallet")
      .eq("user_id", user.id)
      .single();
    if (pe) return bad(pe.message, 500);
    const wallet = (prof?.primary_wallet || "").toLowerCase();
    if (!wallet) return bad("Primary wallet not set", 400);

    // 最終同期ブロックから再開
    const { data: state } = await s
      .from("wallet_sync_state")
      .select("last_block")
      .eq("user_id", user.id)
      .maybeSingle();

    const fromBlock = state?.last_block ?? 0;
    const fromBlockHex = "0x" + (fromBlock >= 0 ? fromBlock.toString(16) : "0");

    // 受け取り / 送信 の2方向で取得
    const [ins, outs] = await Promise.all([
      fetchTransfers("in", wallet, fromBlockHex),
      fetchTransfers("out", wallet, fromBlockHex),
    ]);

    const all = [...ins, ...outs];

    // 変換して upsert（tx_hash 一意で重複吸収）
    const rows = all.map((t) => {
      const blockBn = hexToBigint(t.blockNum);
      const ts = t.metadata?.blockTimestamp
        ? new Date(t.metadata.blockTimestamp)
        : undefined;

      const dir =
        t.from?.toLowerCase() === wallet && t.to?.toLowerCase() === wallet
          ? "self"
          : t.to?.toLowerCase() === wallet
            ? "in"
            : "out";

      const wei = toWeiString(t.value, t.rawContract?.value);

      return {
        user_id: user.id,
        wallet_address: wallet,
        chain_id: 1,
        direction: dir,
        tx_hash: t.hash,
        block_number: blockBn ? Number(blockBn) : null,
        timestamp: ts ? ts.toISOString() : null,
        from_address: t.from?.toLowerCase() ?? null,
        to_address: t.to?.toLowerCase() ?? null,
        value_wei: wei,
        asset_symbol: t.asset ?? null,
        raw: t as unknown as Record<string, unknown>,
      };
    });

    // バッチで upsert
    const chunk = 100;
    for (let i = 0; i < rows.length; i += chunk) {
      const batch = rows.slice(i, i + chunk);
      if (batch.length === 0) continue;
      const { error } = await s
        .from("wallet_transactions")
        .upsert(batch, { onConflict: "tx_hash" });
      if (error) return bad(error.message, 500);
    }

    // last_block 更新（最大ブロック）
    const maxBlock = Math.max(
      fromBlock,
      ...rows.map((r) => (r.block_number ?? 0))
    );

    const { error: ue } = await s.from("wallet_sync_state").upsert({
      user_id: user.id,
      wallet_address: wallet,
      chain_id: 1,
      last_block: isFinite(maxBlock) ? maxBlock : fromBlock,
      updated_at: new Date().toISOString(),
    });
    if (ue) return bad(ue.message, 500);

    return json({
      ok: true,
      synced: rows.length,
      fromBlock,
      toBlock: maxBlock,
    });
  } catch (e) {
    return bad((e as Error).message || String(e), 500);
  }
});
