import { describe, expect, it } from 'vitest'
import { DEFAULT_PORTS, defineConfig, MODEL_VERSION } from '../src'

describe('shared', () => {
  it('defineConfig returns the config unchanged', () => {
    const config = { appDir: 'src/app', capture: { storeRaw: true } }
    expect(defineConfig(config)).toBe(config)
  })

  it('exposes stable defaults', () => {
    expect(MODEL_VERSION).toBe(2)
    expect(DEFAULT_PORTS).toEqual({ dashboard: 4400, app: 3000 })
  })
})
