import { defineHandler } from 'nitro'

import { fail, ok } from '#/utils/http'
import { generateQrcode } from '#/utils/qrcode'

/* 生成二维码 */
export default defineHandler(async () => {
  try {
    const result = await generateQrcode()
    return ok(result)
  } catch (err) {
    return fail({
      message: '二维码生成失败',
      error: err
    })
  }
})
