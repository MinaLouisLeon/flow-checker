export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET as string
  const ok = request.headers.get('x-signature') === secret
  if (process.env.DEBUG_SQL) console.log('webhook', ok)
  return Response.json({ ok })
}
