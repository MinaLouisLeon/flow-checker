'use client'

import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { saveToken, verifyOtp } from '@/lib/auth-api'

interface VerifyOtpFormProps {
  challengeId: string | null
}

// Flow step 2: POST /auth/verify-otp -> store token -> navigate to /dashboard.
export function VerifyOtpForm({ challengeId }: VerifyOtpFormProps) {
  const t = useTranslations('Verify')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  if (!challengeId) {
    return <Link href="/login">{t('missingChallenge')}</Link>
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!challengeId) return
    const code = String(new FormData(event.currentTarget).get('code'))
    try {
      const { token } = await verifyOtp({ challengeId, code })
      saveToken(token)
      router.replace('/dashboard')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{t('title')}</h1>
      <input name="code" inputMode="numeric" placeholder={t('code')} />
      <button type="submit">{t('submit')}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
