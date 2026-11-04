import 'server-only'

export const API_KEY = process.env.API_KEY ?? ''

export function maskKey(key: string): string {
  return key.replace(/.(?=.{4})/g, '*')
}
