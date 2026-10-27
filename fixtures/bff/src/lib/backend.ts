// Server-side client for the external API (the second hop of the BFF chain).
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4010'

export function backend(path: string, init?: RequestInit) {
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  })
}
