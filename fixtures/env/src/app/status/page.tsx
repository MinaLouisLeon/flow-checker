import { connectionLabel } from '@/lib/db'
import { flag } from '@/lib/flags'

export const metadata = { title: 'Status' }

export default function Status() {
  return (
    <main>
      <p>{connectionLabel()}</p>
      <p>{flag('beta') ? 'beta' : 'stable'}</p>
      <p>{process.env.SENTRY_DSN ? 'errors reported' : 'errors not reported'}</p>
    </main>
  )
}
