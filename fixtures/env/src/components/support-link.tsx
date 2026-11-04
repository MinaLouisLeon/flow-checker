'use client'

// `process.env['NAME']` is inlined like `process.env.NAME`.
export function SupportLink() {
  return (
    <a
      // biome-ignore lint/complexity/useLiteralKeys: the literal key form is the case under test
      href={`mailto:${process.env['NEXT_PUBLIC_SUPPORT_EMAIL']}`}
      onClick={() => console.log('support')}
    >
      Support
    </a>
  )
}
