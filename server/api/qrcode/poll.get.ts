import { defineHandler } from 'nitro'
import { getQuery, setCookie } from 'nitro/h3'

import { fail, ok } from '#/utils/http'
import { pollQrcode } from '#/utils/qrcode'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

/* 轮询二维码状态 */
export default defineHandler(async (event) => {
  const { qrcode_key } = getQuery(event)

  try {
    const { data, credentials } = await pollQrcode(String(qrcode_key))

    // 写 Cookie 是 Web 场景特有的动作，CLI 场景不需要，
    // 所以放在 API handler 里，不放进纯函数 pollQrcode
    if (credentials) {
      setCookie(event, 'SESSDATA', credentials.SESSDATA, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: COOKIE_MAX_AGE
      })
      setCookie(event, 'bili_jct', credentials.bili_jct, {
        secure: true,
        sameSite: 'none',
        maxAge: COOKIE_MAX_AGE
      })

      return ok({
        data: { ...data, certificate: credentials }
      })
    }

    return ok({ data })
  } catch (err) {
    return fail({ message: '二维码状态查询失败', error: err })
  }
})
