/* ok */

import { RequestError } from './request'

interface ApiOkOptions<T = unknown> {
  code?: number
  data: T
  message?: string
  status?: number
}

export function ok<T = unknown>({
  data,
  message = 'ok',
  code = 0,
  status = 200
}: ApiOkOptions<T>): Response {
  return Response.json({ code, message, data }, { status })
}

/* fail */

interface ApiFailOptions {
  message: string
  error?: unknown
  status?: number
}

export function fail({
  message,
  error,
  status = 500
}: ApiFailOptions): Response {
  return Response.json(
    {
      code: -1,
      message,
      ...(error !== undefined ? { error: serializeError(error) } : {})
    },
    { status }
  )
}

function serializeError(error: unknown): unknown {
  if (error instanceof RequestError) {
    return {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      body: error.body
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return error
}
