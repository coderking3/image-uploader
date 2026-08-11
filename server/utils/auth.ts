import type { H3Event } from 'nitro'

import { env } from 'node:process'

import { deleteCookie, setCookie } from 'nitro/h3'

import { API } from '#/constants'
import { request } from '#/utils/http'

const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: AUTH_COOKIE_MAX_AGE,
  path: '/',
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production'
}

export interface AuthCertificate {
  SESSDATA: string
  bili_jct: string
}

export type AuthValidationResult<T> =
  { valid: true; data: T } | { valid: false; code: number; message: string }

export function setAuthCookies(
  event: H3Event,
  certificate: AuthCertificate
): void {
  setCookie(event, 'SESSDATA', certificate.SESSDATA, AUTH_COOKIE_OPTIONS)
  setCookie(event, 'bili_jct', certificate.bili_jct, AUTH_COOKIE_OPTIONS)
}

export function clearAuthCookies(event: H3Event): void {
  deleteCookie(event, 'SESSDATA', AUTH_COOKIE_OPTIONS)
  deleteCookie(event, 'bili_jct', AUTH_COOKIE_OPTIONS)
}

export async function validateAuthCertificate<T = unknown>(
  certificate: AuthCertificate
): Promise<AuthValidationResult<T>> {
  const result = await request<T>(API.MY_INFO, {
    headers: {
      Cookie: `SESSDATA=${certificate.SESSDATA}; bili_jct=${certificate.bili_jct}`
    }
  })

  if (result.code !== 0 || result.data == null) {
    return {
      valid: false,
      code: Number(result.code) || -101,
      message: result.message || 'Cookie 无效或已过期'
    }
  }

  return { valid: true, data: result.data }
}
