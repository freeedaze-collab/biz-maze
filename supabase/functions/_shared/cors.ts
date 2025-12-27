
// supabase/functions/_shared/cors.ts

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // In production, replace with your specific domain
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
