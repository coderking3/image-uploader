import process from 'node:process'

import { defineHandler } from 'nitro'
import { handleCors } from 'nitro/h3'

export default defineHandler((event) => {
  if (!event.url.pathname.startsWith('/api/')) return

  const origin = process.env.CORS_ORIGIN || 'http://localhost:3060'

  return handleCors(event, {
    origin: [origin],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
  })
})
