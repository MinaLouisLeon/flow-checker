'use client'

export function formatTotal(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}
