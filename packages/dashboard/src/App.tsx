import { CLI_NAME, MODEL_VERSION } from '@flow-checker/shared'

// Placeholder shell. Screens are built in M4 (see docs/PLAN.md section 9).
export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>{CLI_NAME}</h1>
      <p>Dashboard placeholder. Model format v{MODEL_VERSION}.</p>
    </main>
  )
}
