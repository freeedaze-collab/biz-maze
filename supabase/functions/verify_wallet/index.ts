// supabase/functions/verify_wallet/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyMessage } from "npm:ethers@6.13.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// 本番は自ドメインに絞る
const ALLOW_ORIGIN = "*";

const withCors = (r: Response) => {
  const h = new Headers(r.headers);
  h.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  h.set("Access-Control-Allow-Headers", "authorization, content-type");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return new Response(r.body, { status: r.status, headers: h });
};
const json = (b: unknown, s = 200) =>
  withCors(new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } }));
const bad = (m: string, s = 400, extra?: unknown) => {
  if (extra) console.log("[verify_wallet] bad:", m, extra);
  else console.log("[verify_wallet] bad:", m);
  return json({ error: m }, s);
};

const toL = (v: string) => (v || "").trim().toLowerCase();
const isAddr = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");
const nonce16 = () => {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, "0")).join("");
};

// サーバとフロントで完全一致させるためのテンプレート（ここを単一のソースに）
const buildSignText = (nonce: string) =>
  `BizMaze Wallet Linking\n\nPlease sign this message to prove ownership of your wallet.\n\nNonce: ${nonce}`;

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));

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

      // フロントはこの signText をそのまま署名する（ズレ防止）
      const signText = buildSignText(nonce);
      return json({ nonce, signText });
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

      // サーバ側も同じテンプレでメッセージを再構成
      const signText = buildSignText(n.nonce);

      let recovered = "";
      try {
        recovered = toL(verifyMessage(signText, signature));
      } catch (e) {
        return bad("Invalid signature", 400, { e: String(e) });
      }

      if (recovered !== address) {
        return json({ error: "Signature does not match the address", dbg: { input: address, recovered } }, 400);
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
