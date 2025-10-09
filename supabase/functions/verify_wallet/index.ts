// supabase/functions/verify_wallet/index.ts
// フロントは変更不要（/verify_wallet?dbg=1 で呼ばれる想定）
// 署名検証は MetaMask が署名した nonce を verifyMessage に渡すのが重要。
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Edge Runtime では npm スキーマが安定（esm.sh 由来のバンドル差分でプレビューが落ちるのを回避）
import { verifyMessage } from "npm:ethers@6.13.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// 本番は自ドメインへ絞る（例: https://yourapp.example）
const ALLOW_ORIGIN = "*";

const withCors = (resp: Response) => {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  h.set("Access-Control-Allow-Headers", "authorization, content-type");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return new Response(resp.body, { status: resp.status, headers: h });
};
const json = (body: unknown, status = 200) =>
  withCors(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
const bad = (msg: string, status = 400, extra?: unknown) => {
  if (extra) console.log("[verify_wallet] bad:", msg, extra);
  else console.log("[verify_wallet] bad:", msg);
  return json({ error: msg }, status);
};

const toL = (v: string) => (v || "").trim().toLowerCase();
const isAddr = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");
const nonce16 = () => {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, "0")).join("");
};

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));

    const url = new URL(req.url);
    const dbg = url.searchParams.get("dbg") === "1"; // デバッグはクエリで

    // Verify JWT（ダッシュボードの「Verify JWT」ON 前提）
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return bad("Missing Bearer token", 401);

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: gu, error: gue } = await svc.auth.getUser(token);
    if (gue || !gu?.user) return bad("Not authenticated", 401, { gue });
    const user = gu.user;

    if (req.method === "GET") {
      const nonce = nonce16();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await svc.from("wallet_nonces").upsert({
        user_id: user.id,
        nonce,
        expires_at: expires,
      });
      if (error) return bad("Failed to store nonce", 500, { error });
      if (dbg) console.log("[GET] nonce:", nonce);
      return json({ nonce });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null) as { address?: string; signature?: string } | null;
      const address = toL(body?.address || "");
      const signature = (body?.signature || "").trim();
      if (!isAddr(address)) return bad("Invalid address", 422);
      if (!signature) return bad("Missing signature", 422);

      const { data: n, error: ne } = await svc
        .from("wallet_nonces")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (ne || !n) return bad("Nonce not found", 400, { ne });
      if (new Date(n.expires_at).getTime() < Date.now()) return bad("Nonce expired", 400);

      // ★ ここが肝：MetaMask が署名したのは nonce（生文字列）
      let recovered = "";
      try {
        recovered = toL(verifyMessage(n.nonce, signature));
      } catch (e) {
        return bad("Invalid signature", 400, { e: String(e) });
      }

      const match = recovered === address;
      if (dbg) console.log("[POST verify]", { input: address, recovered, match });

      if (!match) {
        return json(
          { error: "Signature does not match the address", dbg: { input: address, recovered } },
          400,
        );
      }

      const { error: upErr } = await svc.from("wallets").upsert(
        { user_id: user.id, address, verified: true },
        { onConflict: "user_id,address" },
      );
      if (upErr) return bad("Failed to upsert wallet", 500, { upErr });

      await svc.from("wallet_nonces").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    return bad("Method not allowed", 405);
  } catch (e) {
    console.error("[verify_wallet] fatal:", e);
    return bad((e as Error).message || String(e), 500);
  }
});
