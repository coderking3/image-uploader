import type { H3Event } from 'nitro'

import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { Busboy } from '@fastify/busboy'

type MultipartRecord = Record<string, unknown>

export interface ParseMultipartOptions {
  /** 单文件大小上限（字节），默认 10MB */
  fileSize?: number
  /** 文件数量上限，默认 5 */
  files?: number
  /** 普通字段数量上限，默认 20 */
  fields?: number
  /** 普通字段值长度上限（字节），默认 1MB */
  fieldSize?: number
}

const DEFAULT_LIMITS: Required<ParseMultipartOptions> = {
  fileSize: 10 * 1024 * 1024,
  files: 5,
  fields: 20,
  fieldSize: 1 * 1024 * 1024
}

export function parseMultipart<T = unknown>(
  event: H3Event,
  key: string,
  options?: ParseMultipartOptions
): Promise<T | null>

export function parseMultipart<T extends MultipartRecord = MultipartRecord>(
  event: H3Event,
  keys: string[],
  options?: ParseMultipartOptions
): Promise<T>

export function parseMultipart(
  event: H3Event,
  keyOrKeys: string | string[],
  options: ParseMultipartOptions = {}
): Promise<unknown> {
  const limits = { ...DEFAULT_LIMITS, ...options }

  return new Promise((resolve, reject) => {
    let settled = false
    const safeResolve = (value: unknown) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const safeReject = (err: Error) => {
      if (settled) return
      settled = true
      reject(err)
    }

    const result: MultipartRecord = {}

    const contentType = event.req.headers.get('content-type')

    if (!contentType?.includes('multipart/form-data')) {
      return reject(new Error('Content-Type must be multipart/form-data'))
    }

    const isSingle = typeof keyOrKeys === 'string'
    const targetKeys = isSingle ? [keyOrKeys] : keyOrKeys
    const hasFilter = !!targetKeys?.length

    const appendValue = (key: string, value: string | File) => {
      const current = result[key]

      if (!current) {
        result[key] = value
      } else if (Array.isArray(current)) {
        current.push(value)
      } else {
        result[key] = [current, value]
      }
    }

    if (!event.req.body) {
      return resolve(isSingle ? null : result)
    }

    const busboy = new Busboy({
      headers: {
        'content-type': contentType
      },
      limits: {
        fileSize: limits.fileSize,
        files: limits.files,
        fields: limits.fields,
        fieldSize: limits.fieldSize
      }
    })

    // 解析普通表单字段
    busboy.on('field', (name, value) => {
      if (hasFilter && !targetKeys!.includes(name)) return

      appendValue(name, value)
    })

    // 解析文件字段，Busboy 返回的是 Node Stream，需要手动收集数据
    // 注意：file 事件签名是 (fieldname, stream, filename, encoding, mimeType)
    // 少写 encoding 会导致 mimeType 参数错位
    busboy.on('file', (name, stream, filename, _encoding, mimeType) => {
      const shouldSkip = (hasFilter && !targetKeys!.includes(name)) || !filename

      if (shouldSkip) {
        // 未匹配 / 空文件名的流必须消费，否则可能阻塞 Busboy 后续解析
        stream.resume()
        return
      }

      const chunks: Uint8Array[] = []
      let truncated = false

      stream.on('data', (chunk) => {
        chunks.push(chunk)
      })

      // fileSize 超限时 busboy 会 emit 'limit'，流会被截断但不会报错
      stream.on('limit', () => {
        truncated = true
      })

      stream.on('error', safeReject)

      stream.on('end', () => {
        if (truncated) {
          safeReject(
            new Error(
              `File "${filename}" exceeds size limit of ${limits.fileSize} bytes`
            )
          )
          return
        }

        appendValue(
          name,
          new File([Buffer.concat(chunks)], filename, {
            type: mimeType
          })
        )
      })
    })

    busboy.on('filesLimit', () => {
      safeReject(new Error(`Too many files, limit is ${limits.files}`))
    })

    busboy.on('fieldsLimit', () => {
      safeReject(new Error(`Too many fields, limit is ${limits.fields}`))
    })

    busboy.on('finish', () => {
      // 传入单个 key 时直接返回对应值
      safeResolve(isSingle ? (result[keyOrKeys] ?? null) : result)
    })

    busboy.on('error', safeReject)

    pipeline(Readable.fromWeb(event.req.body), busboy).catch(safeReject)
  })
}
