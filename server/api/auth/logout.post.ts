import { defineHandler } from 'nitro'

import { clearAuthCookies } from '#/utils/auth'
import { ok } from '#/utils/http'

export default defineHandler((event) => {
  clearAuthCookies(event)
  return ok({ data: null })
})
