export class RequestError extends Error {
  status: number
  statusText: string
  url: string
  body?: string

  constructor(res: Response, body?: string) {
    super(`请求失败: ${res.status}`)
    this.name = 'RequestError'
    this.status = res.status
    this.statusText = res.statusText
    this.url = res.url
    this.body = body
  }
}

export interface RequestResult<T = any> {
  code: 0 | 1
  message: string
  ttl?: number
  data: T
}

type BodyInit = RequestInit['body']
type RequestData = BodyInit | Record<string, any> | any[]

interface BaseRequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, any> | URLSearchParams
}

type RequestOptions =
  | (BaseRequestOptions & { data?: RequestData; body?: never })
  | (BaseRequestOptions & { body?: BodyInit; data?: never })

export async function requestRaw(
  url: string,
  options: RequestOptions = {}
): Promise<Response> {
  const input = buildUrlWithParams(url, options.params)
  const init = resolveOptions(options)

  const res = await fetch(input, init)

  if (!res.ok) {
    const errorBody = await res.text().catch(() => undefined)
    throw new RequestError(res, errorBody)
  }

  return res
}

export async function request<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<RequestResult<T>> {
  const res = await requestRaw(url, options)
  return (await res.json()) as RequestResult<T>
}

function buildUrlWithParams(
  url: string,
  params?: Record<string, any> | URLSearchParams
): string {
  if (!params) return url

  const urlObj = new URL(url)

  const entries =
    params instanceof URLSearchParams
      ? params.entries()
      : Object.entries(params)

  for (const [key, value] of entries) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        urlObj.searchParams.delete(key)
        value.forEach((v) => urlObj.searchParams.append(key, String(v)))
      } else {
        urlObj.searchParams.set(key, String(value))
      }
    }
  }

  return urlObj.toString()
}

function resolveOptions(options: RequestOptions): RequestInit {
  const { params, data, body, headers, ...fetchOptions } = options

  const finalHeaders = new Headers(headers)
  let finalBody = body

  if (body === undefined && data !== undefined) {
    const { body: transformedBody, contentType } = transformBody(data)
    finalBody = transformedBody

    if (contentType && !finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', contentType)
    }
  }

  return {
    ...fetchOptions,
    headers: finalHeaders,
    body: finalBody
  }
}

function transformBody(data: any): { body: any; contentType?: string } {
  if (data === undefined || data === null) {
    return { body: null }
  }

  const isPlainObjectOrArray =
    Array.isArray(data) ||
    (typeof data === 'object' &&
      Object.getPrototypeOf(data) === Object.prototype)

  if (isPlainObjectOrArray) {
    return {
      body: JSON.stringify(data),
      contentType: 'application/json'
    }
  }

  return { body: data }
}
