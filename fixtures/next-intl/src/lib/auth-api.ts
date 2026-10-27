import type { LoginRequest, LoginResponse, User, VerifyOtpRequest, VerifyOtpResponse } from '@/types/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010'
const TOKEN_KEY = 'fixture-token'

async function post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data as TRes
}

export const login = (input: LoginRequest) => post<LoginRequest, LoginResponse>('/auth/login', input)

export const verifyOtp = (input: VerifyOtpRequest) =>
  post<VerifyOtpRequest, VerifyOtpResponse>('/auth/verify-otp', input)

export async function getMe(): Promise<User | null> {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (!token) return null
  const res = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
  return res.ok ? res.json() : null
}

export const saveToken = (token: string) => sessionStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY)
