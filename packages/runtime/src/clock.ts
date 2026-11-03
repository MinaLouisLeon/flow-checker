// Time and ids for server code that can run inside a Next render. With Cache Components, Next
// treats `Date.now()`, `new Date()` and `Math.random()` during a prerender as reading the request
// and aborts it (dev prints "encountered the unstable value"). `performance.now()` is allowed, so
// the time is `performance.now()` plus an offset read where no render runs.
import { randomId } from './options'

let offset = Date.now() - performance.now()

/**
 * Reads the wall clock again. Call it where no render runs (an incoming request starting), so a
 * paused monotonic clock (the machine slept) doesn't drift for long.
 */
export function syncClock(): void {
  offset = Date.now() - performance.now()
}

/** The current time as an ISO string, safe inside a render. */
export function isoNow(): string {
  return new Date(performance.now() + offset).toISOString()
}

/** Short unique ids from a counter, with a random part chosen once (outside any render). */
export function createIds(): (prefix: string) => string {
  const seed = randomId('x').slice(2)
  let n = 0
  return (prefix) => `${prefix}_${seed}${(n++).toString(36)}`
}
