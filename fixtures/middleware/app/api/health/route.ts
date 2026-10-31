// Not under the proxy matcher: route handlers stay public.
export function GET() {
  return Response.json({ ok: true })
}
