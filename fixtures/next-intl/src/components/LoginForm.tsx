'use client'

import { useTranslations } from 'next-intl'
import { type FormEvent, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { login } from '@/lib/auth-api'

// Flow step 1: POST /auth/login -> navigate to /verify with the challenge id.
export function LoginForm() {
  const t = useTranslations('Login')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const { challengeId } = await login({
        email: String(form.get('email')),
        password: String(form.get('password')),
      })
      router.push(`/verify?challenge=${challengeId}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{t('title')}</h1>
      <input name="email" type="email" placeholder={t('email')} />
      <input name="password" type="password" placeholder={t('password')} />
      <button type="submit">{t('submit')}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
