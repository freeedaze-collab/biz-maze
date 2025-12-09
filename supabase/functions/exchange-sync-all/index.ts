// supabase/functions/exchange-sync-all/index.ts
// Orchestrates syncing all linked exchanges for the authenticated user by delegating to exchange-sync-worker
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST,OPTIONS",
  "content-type": "application/json",
});

type Body = {
  since?: number | string | null;
  until?: number | string | null;
  kinds?: ("trades" | "deposits" | "withdrawals")[];
};

type WorkerResult = {
  ok?: boolean;
  total?: number;
  inserted?: number;
  errors?: number;
  error?: string;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: cors(origin) });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 認証（エンドユーザーの Bearer トークン）
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "no token" }), { status: 401, headers: cors(origin) });
    }
    const token = authz.slice("Bearer ".length);
    const { data: u } = await supabase.auth.getUser(token);
    const userId = u?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "bad token" }), { status: 401, headers: cors(origin) });
    }

    const body = (await req.json()) as Body;
    const kinds = body.kinds?.length ? body.kinds : ["trades", "deposits", "withdrawals"];

    // 連携済みの取引所を列挙
    const { data: conns, error: connErr } = await supabase
      .from("exchange_connections")
      .select("exchange")
      .eq("user_id", userId)
      .in("status", ["linked_keys", "linked"]);
    if (connErr) throw connErr;
    const exchanges = (conns ?? []).map((c: any) => c.exchange).filter(Boolean);
    if (!exchanges.length) {
      return new Response(JSON.stringify({ error: "no exchanges linked" }), { status: 400, headers: cors(origin) });
    }

    // 各取引所を worker で同期
    const results: Record<string, WorkerResult> = {};
    for (const ex of exchanges) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/exchange-sync-worker`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({
            user_id: userId,
            exchange: ex,
            kinds,
            since: body.since ?? null,
            until: body.until ?? null,
          }),
        });
        const text = await res.text();
        let json: WorkerResult = {};
        try { json = JSON.parse(text); } catch { json = { error: text }; }
        results[ex] = json.ok === false ? { ...json, error: json.error ?? "failed" } : json;
        if (!res.ok) {
          results[ex] = { error: json?.error ?? `status ${res.status}` };
        }
      } catch (e: any) {
        results[ex] = { error: e?.message ?? String(e) };
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: cors(origin) });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: cors(origin) });
  }
});
