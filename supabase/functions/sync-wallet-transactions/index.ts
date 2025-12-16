
// supabase Edge Function: sync_wallet_history (MULTI-WALLET-V3)
// - Fetches all verified wallets from 'wallet_connections' for the user.
// - For each wallet, fetches new transactions from Alchemy since the last sync.
// - Manages sync state (last_block) on a per-wallet basis in 'wallet_sync_state'.
// - Verify JWT: ON (required)
// - Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ALCHEMY_API_URL

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALCHEMY_URL = Deno.env.get("ALCHEMY_API_URL")!;

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
  value?: string;    // "0.0123" (native ETH)
  asset?: string;    // "ETH" / "USDC" etc.
  category: "external" | "internal" | "erc20" | "erc721" | "erc1155";
  rawContract?: { value?: string };
  metadata?: { blockTimestamp?: string };
};

async function fetchTransfers(direction: "in" | "out", address: string, fromBlockHex: string) {
  const baseParams: any = {
    fromBlock: fromBlockHex,
    withMetadata: true,
    excludeZeroValue: false,
    maxCount: "0x64", // 100 per page
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
  try { return Number(BigInt(hex)); } catch { return null; }
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

    const { data: userRes, error: ue } = await svc.auth.getUser(token);
    if (ue || !userRes?.user) return bad("Not authenticated", 401);
    const user = userRes.user;

    // 1. Fetch all connected and verified wallet addresses for the user
    const { data: wallets, error: walletsError } = await svc
      .from("wallet_connections")
      .select("wallet_address")
      .eq("user_id", user.id)
      .not("verified_at", "is", null);

    if (walletsError) return bad(walletsError.message, 500);
    if (!wallets || wallets.length === 0) {
      return json({ ok: true, message: "No verified wallets to sync." });
    }
    
    let totalSynced = 0;
    const walletsProcessed: string[] = [];

    // 2. Loop through each connected wallet
    for (const wallet of wallets) {
      const walletAddress = wallet.wallet_address.toLowerCase();
      walletsProcessed.push(walletAddress);
      
      try {
        // 3. Get the last sync state for this specific wallet
        const { data: state } = await svc
          .from("wallet_sync_state")
          .select("last_block")
          .eq("user_id", user.id)
          .eq("wallet_address", walletAddress)
          .maybeSingle();
        
        const fromBlock = state?.last_block ?? 0;
        const fromBlockHex = "0x" + (fromBlock >= 0 ? fromBlock.toString(16) : "0");

        // 4. Fetch incoming and outgoing transfers
        const [ins, outs] = await Promise.all([
          fetchTransfers("in", walletAddress, fromBlockHex),
          fetchTransfers("out", walletAddress, fromBlockHex),
        ]);
        const all = [...ins, ...outs];
        if (all.length === 0) {
            console.log(`No new txs for ${walletAddress} since block ${fromBlock}`);
            continue;
        }

        const rows = all.map((t) => {
          const bn = hexToNum(t.blockNum);
          const ts = t.metadata?.blockTimestamp ? new Date(t.metadata.blockTimestamp).toISOString() : null;
          const dir =
            t.from?.toLowerCase() === walletAddress && t.to?.toLowerCase() === walletAddress ? "self"
            : t.to?.toLowerCase() === walletAddress ? "in"
            : "out";
          const wei = toWeiString(t.value, t.rawContract?.value);
          return {
            user_id: user.id,
            wallet_address: walletAddress,
            chain_id: 1, // Assuming ETH mainnet from Alchemy URL
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
        
        if (rows.length === 0) continue;

        // 5. Upsert transactions into the database
        const chunk = 100;
        for (let i = 0; i < rows.length; i += chunk) {
          const batch = rows.slice(i, i + chunk);
          const { error } = await svc
            .from("wallet_transactions")
            .upsert(batch, { onConflict: "tx_hash, user_id" });
          if (error) throw new Error(`DB upsert error for ${walletAddress}: ${error.message}`);
        }

        // 6. Update the sync state for this specific wallet
        const maxBlock = Math.max(fromBlock, ...rows.map((r) => r.block_number ?? 0));
        const { error: se } = await svc.from("wallet_sync_state").upsert({
          user_id: user.id,
          wallet_address: walletAddress,
          chain_id: 1,
          last_block: Number.isFinite(maxBlock) ? maxBlock : fromBlock,
          updated_at: new Date().toISOString(),
        });
        if (se) throw new Error(`Sync state update error for ${walletAddress}: ${se.message}`);

        totalSynced += rows.length;
        console.log(`Synced ${rows.length} new txs for ${walletAddress} up to block ${maxBlock}`);

      } catch (walletError) {
          console.error(`Failed to sync wallet ${walletAddress}:`, (walletError as Error).message);
      }
    }

    return json({ 
      ok: true, 
      message: "Sync process completed.",
      total_transactions_synced: totalSynced, 
      wallets_processed: walletsProcessed
    });

  } catch (e) {
    console.error("CRITICAL ERROR in sync_wallet_history:", (e as Error).stack);
    return bad((e as Error).message || String(e), 500);
  }
});

