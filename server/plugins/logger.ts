import type { ConsolaReporter, LogObject } from 'consola'

import { env } from 'node:process'

import { createConsola } from 'consola'
import { colors } from 'consola/utils'
import { definePlugin } from 'nitro'

// ── Environment ──────────────────────────────────────────────

export const isProd = env.NODE_ENV === 'production'

// ── Dev formatting helpers ───────────────────────────────────

function colorMethod(method: string) {
  const map: Record<string, (s: string) => string> = {
    GET: colors.cyan,
    POST: colors.green,
    PUT: colors.yellow,
    PATCH: colors.magenta,
    DELETE: colors.red,
    OPTIONS: colors.gray
  }
  return (map[method] || colors.white)(method.padEnd(7))
}

function colorStatus(status: number) {
  if (status >= 500) return colors.red(String(status))
  if (status >= 400) return colors.yellow(String(status))
  if (status >= 300) return colors.cyan(String(status))
  if (status >= 200) return colors.green(String(status))
  return colors.gray(String(status))
}

function colorDuration(duration: number) {
  if (duration > 500) return colors.red(`${duration}ms`)
  if (duration > 100) return colors.yellow(`${duration}ms`)
  return colors.gray(`${duration}ms`)
}

// ── Production JSON reporter ─────────────────────────────────

const jsonReporter: ConsolaReporter = {
  log(logObj: LogObject) {
    const { date, level, type, tag, args } = logObj

    const serializedArgs = args.map((arg) =>
      arg instanceof Error
        ? { message: arg.message, stack: arg.stack, name: arg.name }
        : arg
    )

    const payload = {
      time: date.toISOString(),
      level,
      type,
      tag: tag || 'app',
      message: serializedArgs.length === 1 ? serializedArgs[0] : serializedArgs
    }

    const line = JSON.stringify(payload)

    // 必须用对应的 console 方法，Vercel 面板的 level 过滤器靠这个识别
    if (type === 'fatal' || type === 'error') {
      console.error(line)
    } else if (type === 'warn') {
      console.warn(line)
    } else {
      // eslint-disable-next-line no-console
      console.log(line)
    }
  }
}

// ── Logger instance ──────────────────────────────────────────

const consola = createConsola({
  level: isProd ? 3 : 4,
  formatOptions: {
    date: !isProd,
    colors: !isProd,
    compact: isProd
  },
  reporters: isProd ? [jsonReporter] : undefined
})

const logger = consola.withTag('k3img')

// ── Request timing ───────────────────────────────────────────

const requestStartTimes = new WeakMap<object, number>()

function isApiRequest(req: { url: string }) {
  const { pathname } = new URL(req.url)
  return pathname.startsWith('/api')
}

// ── Plugin ───────────────────────────────────────────────────

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (!isApiRequest(event.req)) return
    requestStartTimes.set(event.req, performance.now())
  })

  nitroApp.hooks.hook('response', (response, event) => {
    if (!isApiRequest(event.req)) return
    const start = requestStartTimes.get(event.req)
    if (start === undefined) return
    requestStartTimes.delete(event.req)

    const status = response.status ?? 200
    const duration = Math.round(performance.now() - start)
    const method = event.req.method
    const path = event.req.url

    if (isProd) {
      // 生产环境：走 JSON reporter，传结构化字段
      logger.log({ method, status, path, duration })
    } else {
      // 开发环境：走 FancyReporter，拼一行彩色文本
      logger.log(
        `${colorMethod(method)} ${colorStatus(status)}  ${colors.dim(path)} ${colors.dim('·')} ${colorDuration(duration)}`
      )
    }
  })

  nitroApp.hooks.hook('error', (error, { event }) => {
    if (!event) return

    if (isProd) {
      logger.error({
        method: event.req.method,
        path: event.req.url,
        message: error.message,
        stack: error.stack
      })
    } else {
      logger.error(`${event.req.method} ${event.req.url} 处理出错`, error)
    }
  })
})
