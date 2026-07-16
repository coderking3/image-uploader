import type { Buffer } from 'node:buffer'

import { API } from '#/constants'
import { request } from '#/utils/http'

export interface UploadCredentials {
  SESSDATA: string
  bili_jct: string
}

export interface UploadImageInput {
  /** 文件二进制内容，浏览器上传场景是 File/Blob，CLI 场景可以直接传 Buffer */
  data: Blob | Buffer
  /** 文件名，便于排查问题，非必填 */
  filename?: string
}

export interface UploadImageResult {
  /** 图片可访问的 URL，是上传成功后真正需要的字段 */
  location: string
  [key: string]: unknown
}

/**
 * 上传图片到 B 站图床。
 * 纯函数：只依赖传入的文件数据和凭证，不感知 HTTP 请求/Cookie 等上下文，
 * 因此服务端 API handler 和 CLI 脚本都可以直接调用。
 */
export async function uploadImage(
  file: UploadImageInput,
  credentials: UploadCredentials
): Promise<UploadImageResult> {
  const { SESSDATA, bili_jct } = credentials

  const blob =
    file.data instanceof Blob
      ? file.data
      : new Blob([new Uint8Array(file.data)])

  const formData = new FormData()
  formData.append('file', blob, file.filename)
  formData.append('csrf', bili_jct)
  formData.append('bucket', 'openplatform')

  const result = await request<UploadImageResult>(API.UPLOAD_IMAGE, {
    method: 'POST',
    headers: {
      // 注意：Content-Type 不要手动设置，FormData 作为 body 时
      // fetch/undici 会自动生成带 boundary 的 multipart/form-data，
      // 手动覆盖反而会丢失 boundary 导致对方解析失败
      Cookie: `SESSDATA=${SESSDATA}; bili_jct=${bili_jct}`
    },
    body: formData
  })

  // B 站接口的业务错误走 HTTP 200 + code !== 0，requestRaw 的 !res.ok
  // 校验拦不住这种情况，必须在这里显式校验业务 code，否则失败请求会被
  // 当成功处理，data 为 undefined 也会被无声地返回给调用方
  if (result.code !== 0) {
    throw new Error(`上传失败: code=${result.code} message=${result.message}`)
  }

  if (!result.data?.location) {
    throw new Error(`接口未返回图片地址: ${JSON.stringify(result)}`)
  }

  return result.data
}
