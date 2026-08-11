import { defineHandler } from 'nitro'
import { getQuery } from 'nitro/h3'

import { setAuthCookies } from '#/utils/auth'
import { fail, ok } from '#/utils/http'
import { pollQrcode } from '#/utils/qrcode'

/* 轮询二维码状态 */
export default defineHandler(async (event) => {
  const { qrcode_key } = getQuery(event)

  if (typeof qrcode_key !== 'string' || !qrcode_key.trim()) {
    return fail({
      status: 400,
      message: 'qrcode_key 必须是非空字符串'
    })
  }

  const qrcodeKey = qrcode_key.trim()

  try {
    const { data, credentials } = await pollQrcode(qrcodeKey)

    // 写 Cookie 是 Web 场景特有的动作，CLI 场景不需要，
    // 所以放在 API handler 里，不放进纯函数 pollQrcode
    if (credentials) {
      setAuthCookies(event, credentials)
    }

    return ok({ data })
  } catch (err) {
    return fail({ message: '二维码状态查询失败', error: err })
  }
})
