import { Redis } from '@upstash/redis'
import { useRuntimeConfig } from 'nitro/runtime-config'

const KEY = 'stats:hosted-images'

function getRedis() {
  const { upstashRedisRestUrl, upstashRedisRestToken } = useRuntimeConfig()

  if (!upstashRedisRestUrl || !upstashRedisRestToken) {
    throw new Error('Upstash Redis 未配置')
  }

  return new Redis({
    url: upstashRedisRestUrl,
    token: upstashRedisRestToken
  })
}

export async function incrementHostedImageCount() {
  return getRedis().incr(KEY)
}

export async function getHostedImageCount() {
  return (await getRedis().get<number>(KEY)) ?? 0
}
