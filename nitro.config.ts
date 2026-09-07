import process from 'node:process'

import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './server',
  preset: 'vercel',
  routeRules: {
    '/api/**': {
      cors: true,
      headers: {
        'Access-Control-Allow-Origin':
          process.env.CORS_ORIGIN || 'http://localhost:3060'
      }
    }
  },
  runtimeConfig: {
    upstashRedisRestUrl: '',
    upstashRedisRestToken: ''
  },
  plugins: ['./server/plugins/logger.ts']
})
