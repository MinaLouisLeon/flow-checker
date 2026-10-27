// Browser capture runtime. Implemented in M5 (see docs/PLAN.md section 7.2).
// Must stay a no-op unless the app was started by flow-checker.

export function installClientRuntime(): void {
  // M5: patch fetch/XHR, record interactions and navigation, send to ingest.
}
