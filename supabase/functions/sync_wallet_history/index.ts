// supabase Edge Function: sync_wallet_history
// - Verify JWT: ON（必須）
// - Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ALCHEMY_API_URL
// 依存：なし（esm.sh経由でsupabase-js v2を読み込み）

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALCHEMY_URL = Deno.env.get("ALCHEMY_API_URL")!; // 例: https://eth-mainnet.g.alchemy.com/v2/<KEY>

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function bad(msg: string, status = 400) {
  return json({ error: msg }, status);
}

type AlchemyTransfer = {
  blockNum: string;  // hex
  hash: string;
  from: string;
  to: string | null;
  value?: string;    // "0.0123" (native ETH のとき)
  asset?: string;    // "ETH" / "USDC" 等
  category: "external" | "internal" | "erc20" | "erc721" | "erc1155";
  rawContract?: { value?: string };
  metadata?: { blockTimestamp?: string };
};

async function fetchTransfers(direction: "in" | "out", address: string, fromBlockHex: string) {
  const baseParams: any = {
    fromBlock: fromBlockHex,
    withMetadata: true,
    excludeZeroValue: false,
    maxCount: "0x64",
    category: ["external", "internal", "erc20", "erc721", "erc1155"],
  };
  if (direction === "in") baseParams.toAddress = address;
  if (direction === "out") baseParams.fromAddress = address;

  const results: AlchemyTransfer[] = [];
  let pageKey: string | undefined;

  do {
    const body = {
      id: 1,
      jsonrpc: "2.0",
      method: "alchemy_getAssetTransfers",
      params: [{ ...baseParams, pageKey }],
    };
    const r = await fetch(ALCHEMY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Alchemy HTTP ${r.status}`);
    const j = await r.json();
    const res = j?.result;
    if (res?.transfers?.length) results.push(...res.transfers);
    pageKey = res?.pageKey;
  } while (pageKey);

  return results;
}

function hexToNum(hex?: string | null): number | null {
  if (!hex) return null;
  try {
    return Number(BigInt(hex));
  } catch {
    return null;
  }
}

function toWeiString(nativeValue?: string, rawHex?: string): string | null {
  if (nativeValue && /^[0-9.]+$/.test(nativeValue)) {
    const [i, f = ""] = nativeValue.split(".");
    const wei = BigInt(i + (f + "0".repeat(18)).slice(0, 18));
    return wei.toString();
  }
  if (rawHex && /^0x[0-9a-fA-F]+$/.test(rawHex)) {
    try { return BigInt(rawHex).toString(); } catch {}
  }
  return null;
}

serve(async (req) => {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return bad("Missing Bearer token", 401);

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 呼び出しユーザーを特定（Verify JWTがONならこのtokenは検証済み前提）
    const { data: userRes, error: ue } = await svc.auth.getUser(token);
    if (ue || !userRes?.user) return bad("Not authenticated", 401);
    const user = userRes.user;

    // profiles.primary_wallet を取得
    const { data: prof, error: pe } = await svc
      .from("profiles")
      .select("primary_wallet")
      .eq("user_id", user.id)
      .single();
    if (pe) return bad(pe.message, 500);
    const wallet = (prof?.primary_wallet || "").toLowerCase();
    if (!wallet) return bad("Primary wallet not set", 400);

    // 直近ブロック
    const { data: state } = await svc
      .from("wallet_sync_state")
      .select("last_block")
      .eq("user_id", user.id)
      .maybeSingle();
    const fromBlock = state?.last_block ?? 0;
    const fromBlockHex = "0x" + (fromBlock >= 0 ? fromBlock.toString(16) : "0");

    // 双方向で取得
    const [ins, outs] = await Promise.all([
      fetchTransfers("in", wallet, fromBlockHex),
      fetchTransfers("out", wallet, fromBlockHex),
    ]);
    const all = [...ins, ...outs];

    const rows = all.map((t) => {
      const bn = hexToNum(t.blockNum);
      const ts = t.metadata?.blockTimestamp ? new Date(t.metadata.blockTimestamp).toISOString() : null;
      const dir =
        t.from?.toLowerCase() === wallet && t.to?.toLowerCase() === wallet ? "self"
        : t.to?.toLowerCase() === wallet ? "in"
        : "out";
      const wei = toWeiString(t.value, t.rawContract?.value);
      return {
        user_id: user.id,
        wallet_address: wallet,
        chain_id: 1,
        direction: dir,
        tx_hash: t.hash,
        block_number: bn,
        timestamp: ts,
        from_address: t.from?.toLowerCase() ?? null,
        to_address: t.to?.toLowerCase() ?? null,
        value_wei: wei,
        asset_symbol: t.asset ?? null,
        raw: t as unknown as Record<string, unknown>,
      };
    });

    // upsert（tx_hash一意で重複吸収）
    const chunk = 100;
    for (let i = 0; i < rows.length; i += chunk) {
      const batch = rows.slice(i, i + chunk);
      if (batch.length === 0) continue;
      const { error } = await svc
        .from("wallet_transactions")
        .upsert(batch, { onConflict: "tx_hash" });
      if (error) return bad(error.message, 500);
    }

    // last_block 更新
    const maxBlock = Math.max(fromBlock, ...rows.map((r) => r.block_number ?? 0));
    const { error: se } = await svc.from("wallet_sync_state").upsert({
      user_id: user.id,
      wallet_address: wallet,
      chain_id: 1,
      last_block: Number.isFinite(maxBlock) ? maxBlock : fromBlock,
      updated_at: new Date().toISOString(),
    });
    if (se) return bad(se.message, 500);

    return json({ ok: true, synced: rows.length, fromBlock, toBlock: maxBlock });
  } catch (e) {
    return bad((e as Error).message || String(e), 500);
  }
});
