import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './server',
  preset: 'vercel',

  runtimeConfig: {
    upstashRedisRestUrl: '',
    upstashRedisRestToken: ''
  },

  plugins: ['./server/plugins/logger.ts']
})
