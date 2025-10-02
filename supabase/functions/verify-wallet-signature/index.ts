import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  // --- 1) CORS プリフライト対応 ---
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:5173", // 本番なら https://yourdomain.com
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    })
  }

  try {
    // --- 2) ユーザーJWTの取り出し ---
    const auth = req.headers.get("authorization") || ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
    if (!token) return new Response("Missing token", { status: 401 })

    // JWT デコード（Verify JWT ONで署名検証は済）
    const payload = JSON.parse(atob(token.split(".")[1] || "null") || "null")
    const userId = payload?.sub
    if (!userId) return new Response("Invalid token", { status: 401 })

    // --- 3) Supabase サーバークライアント（Service Role 使用） ---
    const supabase = createClient(
      Deno.env.get("PROJECT_URL")!,             // Secretsに設定
      Deno.env.get("SERVICE_ROLE_KEY")!,        // Secretsに設定
      { auth: { persistSession: false } }
    )

    // --- 4) リクエスト本体 ---
    const body = await req.json().catch(() => ({}))

    // TODO: ウォレット署名の検証など
    // await supabase.from("wallet_connections").upsert({ user_id: userId, ... })

    return new Response(JSON.stringify({ ok: true, userId, body }), {
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:5173",
        "Content-Type": "application/json",
      },
    })
  } catch (e) {
    return new Response(`Error: ${String(e)}`, { status: 500 })
  }
})
