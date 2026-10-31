export async function register() {
  // flow-checker: captures server-side requests while you test. It does nothing unless FLOW_CHECKER=1.
  if (process.env.FLOW_CHECKER === '1' && process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerServerRuntime } = await import('@integr8-media/flow-checker/runtime/server')
    registerServerRuntime()
  }
  // flow-checker: requests sent from middleware on the edge runtime (fetch only, best effort).
  if (process.env.FLOW_CHECKER === '1' && process.env.NEXT_RUNTIME === 'edge') {
    const { registerEdgeRuntime } = await import('@integr8-media/flow-checker/runtime/edge')
    registerEdgeRuntime(process.env.FLOW_CHECKER_RUNTIME)
  }
}
