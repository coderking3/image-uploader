import { defineHandler } from 'nitro'

import { getHostedImageCount } from '#/utils/hosted'
import { ok } from '#/utils/http'

export default defineHandler(async () => {
  const totalImages = await getHostedImageCount()

  return ok({ data: { totalImages } })
})
