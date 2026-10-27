export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'member'
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  otpRequired: true
  challengeId: string
}

export interface VerifyOtpRequest {
  challengeId: string
  code: string
}

export interface VerifyOtpResponse {
  token: string
  user: User
}
