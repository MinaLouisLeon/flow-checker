import { defineConfig } from '@integr8-media/flow-checker/config'

export default defineConfig({
  capture: {
    // Sensitive values (passwords, tokens, auth headers...) are masked before they are saved.
    // Set to true only for local debugging.
    storeRaw: false,
  },
})
