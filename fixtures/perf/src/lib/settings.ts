// Settings come through axios, which Next doesn't dedupe: two calls in one render are two requests.
import axios from 'axios'
import { cache } from 'react'
import type { Settings, User } from './types'

const API = 'http://localhost:4010'

export async function getSettings() {
  const res = await axios.get<Settings>(`${API}/settings?delay=40`)
  return res.data
}

/** Wrapped in React's `cache()`: called from the layout and the page, it runs once per render. */
export const getAccount = cache(async (id: number) => {
  const res = await axios.get<User>(`${API}/users/${id}?delay=20`)
  return res.data
})
