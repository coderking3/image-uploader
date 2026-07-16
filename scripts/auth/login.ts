import type { CredentialScope } from './credentials'

import { select } from '@inquirer/prompts'
import qrcodeTerminal from 'qrcode-terminal'

import { generateQrcode, pollQrcode } from '#/utils/qrcode'

import { readCredentials, saveCredentials } from './credentials'

export interface LoginCredentials {
  SESSDATA: string
  bili_jct: string
}

// 和 QrcodePanel.tsx 保持一致：2 秒轮询一次，3 分钟过期
const POLL_INTERVAL = 2000
const QRCODE_TTL = 180_000

function renderQrcode(url: string): Promise<void> {
  return new Promise((resolve) => {
    qrcodeTerminal.generate(url, { small: true }, (rendered) => {
      console.log(rendered)
      resolve()
    })
  })
}

async function loginWithQrcode(): Promise<LoginCredentials> {
  const { data } = await generateQrcode()
  const { url, qrcode_key } = data

  console.log('请使用 B 站 APP 扫描下方二维码登录：\n')
  await renderQrcode(url)

  const startedAt = Date.now()

  return await new Promise<LoginCredentials>((resolve, reject) => {
    let lastStatus = ''

    const timer = setInterval(async () => {
      if (Date.now() - startedAt > QRCODE_TTL) {
        clearInterval(timer)
        reject(new Error('二维码已过期，请重新运行命令'))
        return
      }

      try {
        const result = await pollQrcode(qrcode_key)

        if (result.status !== lastStatus) {
          lastStatus = result.status
          if (result.status === 'scanned') {
            console.log('已扫描，请在手机上确认登录')
          }
        }

        if (result.status === 'expired') {
          clearInterval(timer)
          reject(new Error('二维码已失效，请重新运行命令'))
          return
        }

        if (result.status === 'confirmed') {
          clearInterval(timer)

          if (!result.credentials) {
            reject(new Error('登录成功但未能获取到凭证，请重试'))
            return
          }

          console.log('扫码登录成功')
          resolve(result.credentials)
        }

        // waiting 状态不打印，避免刷屏
      } catch (err) {
        clearInterval(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }, POLL_INTERVAL)
  })
}

/**
 * 确保脚本拥有可用的登录凭证：
 * 优先读缓存（本地优先，其次全局），没有或过期才走终端扫码登录，
 * 登录成功后按 cacheOption 指定的位置存储；不传则交互式选择，默认本地。
 */
export async function ensureLogin(
  cacheOption?: CredentialScope
): Promise<LoginCredentials> {
  const cached = readCredentials()

  if (cached) {
    console.log('已读取本地缓存的登录凭证，跳过扫码')
    return cached
  }

  const credentials = await loginWithQrcode()

  const scope =
    cacheOption ??
    (await select<CredentialScope>({
      message: '登录凭证缓存到哪里？',
      default: 'local',
      choices: [
        { name: '当前目录 (./.k3img/)', value: 'local' },
        { name: '全局 (~/.k3img/)', value: 'global' }
      ]
    }))

  saveCredentials(credentials, scope)

  return credentials
}
