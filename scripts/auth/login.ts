import type { CredentialScope } from './credentials'

import process from 'node:process'

import { generateQrcode, pollQrcode } from '#server/utils/qrcode'
import { cancel, isCancel, log, select } from '@clack/prompts'
import qrcodeTerminal from 'qrcode-terminal'

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

  log.step('请使用 B 站 APP 扫描二维码')
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
            log.info('已扫描，请在手机上确认登录')
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

          log.success('扫码登录成功')
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
    log.info('已使用缓存的登录凭证')
    return cached
  }

  const credentials = await loginWithQrcode()

  const selectedScope =
    cacheOption ??
    (await select<CredentialScope>({
      message: '登录凭证保存位置',
      initialValue: 'local',
      options: [
        { label: '当前目录', hint: './.k3img/', value: 'local' },
        { label: '全局', hint: '~/.k3img/', value: 'global' }
      ],
      showInstructions: false
    }))

  if (isCancel(selectedScope)) {
    cancel('已取消保存登录凭证')
    process.exit(0)
  }

  saveCredentials(credentials, selectedScope)
  log.success(
    `已保存登录凭证 · ${selectedScope === 'local' ? '当前目录' : '全局'}`
  )

  return credentials
}
