import { defineHandler } from 'nitro'
import { getCookie } from 'nitro/h3'

import { fail, ok } from '#/utils/http'
import { parseMultipart } from '#/utils/multipart'
import { uploadImage } from '#/utils/upload'

export default defineHandler(async (event) => {
  const sessdata = getCookie(event, 'SESSDATA')
  const biliJct = getCookie(event, 'bili_jct')

  if (!sessdata || !biliJct) {
    return fail({
      status: 400,
      message: '缺少 SESSDATA 或 bili_jct Cookie，无法上传图片'
    })
  }

  try {
    const file = await parseMultipart<File>(event, 'file')

    if (!file) {
      return fail({
        status: 400,
        message: '请使用 multipart/form-data 上传 file 字段'
      })
    }

    const data = await uploadImage(
      { data: file, filename: file.name },
      { SESSDATA: sessdata, bili_jct: biliJct }
    )

    return ok({ data })
  } catch (err) {
    return fail({ status: 502, message: '上传失败', error: err })
  }
})
