// supabase/functions/verify_wallet/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOW_ORIGIN = "*";

function withCors(r: Response) {
  const h = new Headers(r.headers);
  h.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  h.set("Access-Control-Allow-Headers", "authorization, content-type");
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return new Response(r.body, { status: r.status, headers: h });
}
function json(b: unknown, s = 200) {
  return withCors(
    new Response(JSON.stringify(b), {
      status: s,
      headers: { "content-type": "application/json" },
    }),
  );
}
function bad(msg: string, s = 400, extra?: unknown) {
  if (extra) console.log("[verify_wallet] bad:", msg, extra);
  else console.log("[verify_wallet] bad:", msg);
  return json({ error: msg }, s);
}
const toL = (v: string) => (v || "").trim().toLowerCase();
const isAddr = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");
const nonce16 = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));
    const url = new URL(req.url);
    const dbg = url.searchParams.get("dbg") === "1";

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
      if (dbg) console.log("[GET] nonce issued:", nonce);
      return json({ nonce });
    }

    if (req.method === "POST") {
      const b = await req.json().catch(() => null) as { address?: string; signature?: string } | null;
      const address = toL(b?.address || "");
      const sig = (b?.signature || "").trim();
      if (!isAddr(address)) return bad("Invalid address", 422);
      if (!sig) return bad("Missing signature", 422);

      const { data: n, error: ne } = await svc
        .from("wallet_nonces")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (ne || !n) return bad("Nonce not found", 400, { ne });
      if (new Date(n.expires_at).getTime() < Date.now()) return bad("Nonce expired", 400);

      let recovered = "";
      try {
        // ✅ ethers.verifyMessage(message, signature)
        //    message は MetaMask が署名した nonce と完全一致させる必要がある
        recovered = toL(ethers.verifyMessage(n.nonce, sig));
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
