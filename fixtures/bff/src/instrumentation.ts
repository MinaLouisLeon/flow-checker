export async function register() {
  // flow-checker: captures server-side requests while you test. It does nothing unless FLOW_CHECKER=1.
  if (process.env.FLOW_CHECKER === '1' && process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerServerRuntime } = await import('@integr8/flow-checker/runtime/server')
    registerServerRuntime()
  }
}
