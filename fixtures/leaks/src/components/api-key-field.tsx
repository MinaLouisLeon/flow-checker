'use client'

import { useState } from 'react'
import { maskKey } from '@/lib/keys'

export function ApiKeyField() {
  const [key, setKey] = useState('')
  return <input value={maskKey(key)} onChange={(e) => setKey(e.target.value)} />
}
