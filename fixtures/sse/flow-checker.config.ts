import { defineConfig } from '@integr8-media/flow-checker/config'

export default defineConfig({
  capture: {
    // Sensitive values (passwords, tokens, auth headers...) are masked before they are saved.
    // Set to true only for local debugging.
    storeRaw: false,
    // Event stream messages kept per connection, and the largest message kept with its data.
    maxMessages: 50,
    maxMessageBytes: 16_000,
  },
})
