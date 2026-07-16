import type { RequestResult } from '#/utils/http'

import { API } from '#/constants'
import { pickCookie, request, requestRaw } from '#/utils/http'

export interface QrcodeGenerateData {
  url: string
  qrcode_key: string
}

/** 轮询返回的原始状态数据（对应 B 站接口的 data 字段） */
export interface QrcodePollData {
  code: number
  message: string
  url?: string
  refresh_token?: string
  timestamp?: number
}

export type QrcodeStatus = 'waiting' | 'scanned' | 'expired' | 'confirmed'

export interface QrcodeCredentials {
  SESSDATA: string
  bili_jct: string
}

export interface QrcodePollResult {
  status: QrcodeStatus
  data: QrcodePollData
  /** 仅在 status 为 confirmed 且成功从 Set-Cookie 中解析出凭证时存在 */
  credentials?: QrcodeCredentials
}

/** 生成二维码，返回二维码 URL 和 qrcode_key */
export function generateQrcode() {
  return request<QrcodeGenerateData>(API.QRCODE_GENERATE)
}

function resolveStatus(code: number): QrcodeStatus {
  switch (code) {
    case 0:
      return 'confirmed'
    case 86038:
      return 'expired'
    case 86090:
      return 'scanned'
    case 86101:
      return 'waiting'
    default:
      // 未知 code 按 waiting 处理，避免误判为终止状态
      return 'waiting'
  }
}

/**
 * 轮询二维码状态。
 * 成功时会尝试从响应的 Set-Cookie 中解析出 SESSDATA / bili_jct，
 * 是否要把凭证写入浏览器 Cookie 由调用方（API handler）决定，这里只负责解析。
 */
export async function pollQrcode(qrcodeKey: string): Promise<QrcodePollResult> {
  const res = await requestRaw(API.QRCODE_POLL, {
    params: { qrcode_key: qrcodeKey }
  })
  const result = (await res.json()) as RequestResult<QrcodePollData>
  const { data } = result

  const status = resolveStatus(data.code)

  if (status !== 'confirmed') {
    return { status, data }
  }

  const [sessdata, biliJct] = pickCookie(res.headers.getSetCookie(), [
    'SESSDATA',
    'bili_jct'
  ])

  if (!sessdata || !biliJct) {
    // 登录成功但没能拿到凭证，理论上不应该发生，交给调用方处理
    return { status, data }
  }

  return {
    status,
    data,
    credentials: { SESSDATA: sessdata, bili_jct: biliJct }
  }
}
