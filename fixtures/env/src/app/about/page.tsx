import { SiteName } from '@/components/site-name'
import { SupportLink } from '@/components/support-link'
import { ThemeName } from '@/components/theme-name'

export const metadata = { title: 'About' }

export default function About() {
  return (
    <main>
      <SiteName />
      <SupportLink />
      <ThemeName />
    </main>
  )
}
