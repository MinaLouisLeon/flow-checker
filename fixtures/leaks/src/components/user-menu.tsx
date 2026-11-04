'use client'

import { useEffect, useState } from 'react'
import { currentUser } from '@/lib/session'

export function UserMenu() {
  const [name, setName] = useState('')
  useEffect(() => {
    currentUser().then(setName)
  }, [])
  return <nav>{name || 'Signed out'}</nav>
}
