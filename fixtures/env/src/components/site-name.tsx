'use client'

// Planted: destructuring is a dynamic lookup, so Next doesn't inline the value.
export function SiteName() {
  const { NEXT_PUBLIC_SITE_NAME } = process.env
  return <h1 onDoubleClick={() => window.scrollTo(0, 0)}>{NEXT_PUBLIC_SITE_NAME}</h1>
}
