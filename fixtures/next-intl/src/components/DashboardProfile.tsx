'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { clearToken, getMe } from '@/lib/auth-api'
import type { User } from '@/types/auth'

// Flow step 3: GET /me with the bearer token on page load.
export function DashboardProfile() {
  const t = useTranslations('Dashboard')
  const router = useRouter()
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    getMe().then(setUser)
  }, [])

  function signOut() {
    clearToken()
    router.push('/login')
  }

  if (user === undefined) return <p>…</p>
  if (user === null) return <Link href="/login">{t('notSignedIn')}</Link>

  return (
    <section>
      <h1>{t('title')}</h1>
      <p>{t('greeting', { name: user.name })}</p>
      <button type="button" onClick={signOut}>
        {t('signOut')}
      </button>
    </section>
  )
}
