import { defineHandler } from 'nitro'
import { getCookie } from 'nitro/h3'

import { API } from '#/constants'
import { fail, ok, request } from '#/utils/http'

/* 获取用户信息 */
export default defineHandler(async (event) => {
  const sessdata = getCookie(event, 'SESSDATA')

  if (!sessdata) {
    return fail({ status: 401, message: '缺少登录 Cookie' })
  }

  try {
    const result = await request(API.MY_INFO, {
      headers: { Cookie: `SESSDATA=${sessdata}` }
    })
    return ok(result)
  } catch (err) {
    return fail({ message: '获取用户信息失败', error: err })
  }
})
