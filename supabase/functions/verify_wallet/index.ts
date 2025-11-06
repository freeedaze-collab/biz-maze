// supabase/functions/verify-wallet-signature/index.ts
// --- 依存：supabase-js / viem（Deno の npm） ------------------------------
import { createClient } from "npm:@supabase/supabase-js@2";
import { isAddress, hashMessage, recoverAddress } from "npm:viem@2";

// --- CORS 共通ヘッダ（OPTIONS 204=ボディ無し！） -------------------------
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Max-Age": "86400",
};

// --- 付与ユーティリティ ---------------------------------------------------
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

// --- Supabase クライアントを作る（呼び出し元の Authorization を引き継ぐ）--
function sbFrom(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
}

// --- サーバログを手厚く ---------------------------------------------------
function logReq(req: Request, tag = "req") {
  console.log(tag, {
    method: req.method,
    origin: req.headers.get("Origin"),
    acReqMethod: req.headers.get("Access-Control-Request-Method"),
    contentType: req.headers.get("Content-Type"),
    hasAuth: !!req.headers.get("Authorization"),
  });
}

Deno.serve(async (req) => {
  // 1) プリフライト
  if (req.method === "OPTIONS") {
    logReq(req, "OPTIONS");
    // 204 は絶対に body を付けない
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  logReq(req, "POST");

  // 2) POST 以外は拒否
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  // 3) 認可（JWT 必須）
  const supabase = sbFrom(req);
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    console.error("auth.getUser error", userErr);
    return json({ error: "Unauthorized" }, 401);
  }
  const userId = userRes.user.id;

  // 4) 入力
  let body: any = null;
  try {
    body = await req.json();
  } catch (e) {
    console.error("json parse error", e);
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = body?.action;
  console.log("action", action);

  // 5) ノンス発行
  if (action === "nonce") {
    const nonce = crypto.randomUUID().replace(/-/g, "");
    console.log("nonce issued", { userId, len: nonce.length });
    return json({ nonce }, 200);
  }

  // 6) 検証＆登録
  if (action === "verify") {
    const address: string = body?.address;
    const signature: string = body?.signature;
    const nonce: string = body?.nonce;

    // 入力バリデーション
    if (!isAddress(address)) {
      return json({ error: "Bad address" }, 400);
    }
    if (typeof signature !== "string" || !signature.startsWith("0x")) {
      return json({ error: "Bad signature" }, 400);
    }
    if (typeof nonce !== "string" || nonce.length < 8) {
      return json({ error: "Bad nonce" }, 400);
    }

    // EIP-191 ハッシュで recover
    const recovered = await recoverAddress({ hash: hashMessage(nonce), signature });
    console.log("recovered", { input: address, recovered });

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return json({ error: "Signature does not match address" }, 400);
    }

    // DB upsert（wallets テーブル前提：id PK / user_id / address / verified / created_at）
    const { error: upErr } = await supabase
      .from("wallets")
      .upsert(
        { user_id: userId, address, verified: true },
        { onConflict: "user_id,address" }
      );

    if (upErr) {
      console.error("wallets upsert error", upErr);
      return json({ error: "DB upsert failed", details: upErr.message }, 500);
    }

    return json({ ok: true }, 200);
  }

  // 7) それ以外
  return json({ error: "Unknown action" }, 400);
});
