// Server capture runtime for instrumentation.ts. Implemented in M5 (see docs/PLAN.md section 7.3).
// Must stay a no-op unless FLOW_CHECKER=1.

export function registerServerRuntime(): void {
  if (process.env.FLOW_CHECKER !== '1') return
  // M5: wrap fetch/http, link outgoing calls to the incoming request.
}
