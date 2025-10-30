// supabase/functions/_shared/cors.ts
export const corsHeaders: Record<string, string> = {
  // 必要なら "*" をプレビュー/本番ドメインに絞ってください
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// OPTIONS プリフライトに 200 を返すユーティリティ
export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

// JSON を返すときのヘッダ作成
export function jsonHeaders(extra: Record<string, string> = {}) {
  return { ...corsHeaders, "Content-Type": "application/json", ...extra };
}
