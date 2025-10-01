// supabase/functions/_shared/cors.ts
export const allowOrigins = [
  // ここに本番/プレビュー/ローカルなど、許可したいオリジンを列挙
  'https://<YOUR_PREVIEW>.lovableproject.com',
  'http://localhost:5173',
]

export function getOrigin(req: Request) {
  return req.headers.get('Origin') ?? ''
}

export function isAllowedOrigin(origin: string) {
  return allowOrigins.some((o) => origin === o)
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = getOrigin(req)
  const headers: HeadersInit = {
    'Vary': 'Origin',
  }
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null

  const origin = getOrigin(req)
  const headers: HeadersInit = {
    'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return new Response('ok', { headers })
}
