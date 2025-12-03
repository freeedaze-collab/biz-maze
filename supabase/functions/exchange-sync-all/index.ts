// supabase/functions/exchange-sync-all/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// このログは、ファイルが読み込まれた瞬間に表示されます
console.log("--- [LEVEL 1] SCRIPT LOADED: exchange-sync-all/index.ts ---");

Deno.serve(async (req) => {
  // このログは、リクエストがハンドラに到達した瞬間に表示されます
  console.log(`--- [LEVEL 2] HANDLER INVOKED: Method = ${req.method} ---`);

  if (req.method === 'OPTIONS') {
    console.log("--- [LEVEL 3] Preflight (OPTIONS) request handled. ---");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const responseBody = {
      message: "SUCCESS: If you see this in the browser, exchange-sync-all is ALIVE!",
      timestamp: new Date().toISOString()
    };
    
    console.log("--- [LEVEL 3] Success response prepared. Sending to client. ---");
    
    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error("--- [LEVEL 3] HANDLER CRASHED:", error.message);
    return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

console.log("--- [LEVEL 1] SCRIPT EVALUATED. Waiting for requests... ---");
