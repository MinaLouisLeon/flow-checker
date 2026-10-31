import { defineConfig } from '@integr8-media/flow-checker/config'

export default defineConfig({
  capture: {
    // Sensitive values (passwords, tokens, auth headers...) are masked before they are saved.
    // Set to true only for local debugging.
    storeRaw: false,
  },
  // The API contract: a git-native v3 collection folder and its environment ({{baseUrl}}).
  postman: {
    collection: 'postman/collections/Fixture API',
    environment: 'postman/environments/local.yaml',
  },
})
