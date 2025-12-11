
// supabase/functions/exchange-save-keys/index.ts
// FINAL VERSION 2: Uses import_map to resolve shared modules.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { AES } from "https://deno.land/x/god_crypto@v1.4.10/aes.ts";
import { Env } from "shared/types.ts"; // <<< FIX: Using import_map path

// --- CORS Helper ---
function cors(res: Response) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  return new Response(res.body, { status: res.status, headers: h });
}

const iv = new TextEncoder().encode("SUPER_SECRET_IV_"); // 16 bytes

async function getEncryptionKey(supabaseAdmin: any, userId: string): Promise<Uint8Array> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("encryption_key")
    .eq("id", userId)
    .single();

  if (error || !data || !data.encryption_key) {
    console.error("Failed to get or missing encryption key for user:", userId, error);
    throw new Error("Could not retrieve encryption key.");
  }

  const keyHex = data.encryption_key;
  const key = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  if (key.length !== 32) {
    throw new Error("Invalid encryption key length. Must be 32 bytes for AES-256.");
  }
  return key;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return cors(new Response("ok"));
  }

  try {
    const { exchange, api_key, secret_key } = await req.json();
    const authHeader = req.headers.get("Authorization")!;
    const jwt = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get(Env.SupabaseUrl)!,
      Deno.env.get(Env.SupabaseServiceRoleKey)!
    );

    const { data: { user } } = await supabaseAdmin.auth.getUser(jwt);
    if (!user) {
      return cors(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } }));
    }

    const encryptionKey = await getEncryptionKey(supabaseAdmin, user.id);
    const aes = new AES(encryptionKey, iv);

    const textEncoder = new TextEncoder();
    const encryptedApiKey = await aes.encrypt(textEncoder.encode(api_key));
    const encryptedSecretKey = await aes.encrypt(textEncoder.encode(secret_key));

    const { error: upsertError } = await supabaseAdmin
      .from("exchange_connections")
      .upsert({
        user_id: user.id,
        exchange: exchange,
        api_key_encrypted: encryptedApiKey.hex(),
        secret_key_encrypted: encryptedSecretKey.hex(),
        last_updated: new Date().toISOString(),
      }, { onConflict: "user_id, exchange" });

    if (upsertError) {
      console.error("Supabase upsert error:", upsertError);
      throw upsertError;
    }

    return cors(new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } }));

  } catch (e: any) {
    console.error("!!!!!! Function exchange-save-keys CRASHED !!!!!!", e.message);
    return cors(new Response(JSON.stringify({ 
      error: "An internal server error occurred.",
      details: String(e?.message ?? e) 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    }));
  }
});
