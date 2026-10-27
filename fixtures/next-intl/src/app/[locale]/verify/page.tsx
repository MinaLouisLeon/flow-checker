import { VerifyOtpForm } from '@/components/VerifyOtpForm'

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>
}) {
  const { challenge } = await searchParams
  return (
    <main>
      <VerifyOtpForm challengeId={challenge ?? null} />
    </main>
  )
}
