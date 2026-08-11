import type { AuthCertificate } from '#/utils/auth'

import { defineHandler } from 'nitro'

import { setAuthCookies, validateAuthCertificate } from '#/utils/auth'
import { fail, ok } from '#/utils/http'

interface CertificateBody {
  SESSDATA?: unknown
  bili_jct?: unknown
}

export default defineHandler(async (event) => {
  let body: CertificateBody

  try {
    body = (await event.req.json()) as CertificateBody
  } catch {
    return ok({
      status: 400,
      code: -400,
      message: '请提供有效的 JSON 请求体',
      data: null
    })
  }

  const certificate: AuthCertificate = {
    SESSDATA: typeof body.SESSDATA === 'string' ? body.SESSDATA.trim() : '',
    bili_jct: typeof body.bili_jct === 'string' ? body.bili_jct.trim() : ''
  }

  if (!certificate.SESSDATA || !certificate.bili_jct) {
    return ok({
      status: 400,
      code: -400,
      message: '请完整填写 SESSDATA 和 bili_jct',
      data: null
    })
  }

  try {
    const validation = await validateAuthCertificate(certificate)

    if (!validation.valid) {
      return ok({
        status: 401,
        code: validation.code,
        message: validation.message,
        data: null
      })
    }

    setAuthCookies(event, certificate)
    return ok({ data: validation.data })
  } catch (err) {
    return fail({
      status: 502,
      message: '登录凭证校验失败',
      error: err
    })
  }
})
