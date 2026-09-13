import process from 'node:process'

import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './server',
  preset: 'vercel',

  routeRules: {
    '/api/**': {
      cors: {
        origin: [process.env.CORS_ORIGIN || 'http://localhost:3060'],
        credentials: true
      }
    }
  },

  runtimeConfig: {
    upstashRedisRestUrl: '',
    upstashRedisRestToken: ''
  },

  plugins: ['./server/plugins/logger.ts']
})
