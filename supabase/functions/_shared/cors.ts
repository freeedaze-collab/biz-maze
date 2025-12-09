// supabase/functions/_shared/cors.ts
// PURPOSE: Defines standardized CORS headers and helper functions for use across multiple Edge Functions.

// Defines the standard set of CORS headers.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Handles OPTIONS preflight requests.
 * If the request method is OPTIONS, it returns a 200 OK response with the CORS headers.
 * @param {Request} req The incoming request.
 * @returns {Response | null} A response for OPTIONS requests, or null otherwise.
 */
export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

/**
 * Creates a standard set of headers for JSON responses, including CORS headers.
 * @param {Record<string, string>} [extra={}] - Optional extra headers to add.
 * @returns {Record<string, string>} The combined headers.
 */
export function jsonHeaders(extra: Record<string, string> = {}) {
  return { ...corsHeaders, "Content-Type": "application/json", ...extra };
}
