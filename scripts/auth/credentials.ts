import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export interface StoredCredentials {
  SESSDATA: string
  bili_jct: string
  expireAt: number
}

export type CredentialScope = 'local' | 'global'

// 和服务端 poll.get.ts 里 Cookie 的 maxAge 保持一致（7 天）
const CREDENTIAL_TTL = 60 * 60 * 24 * 7 * 1000

const GLOBAL_CREDENTIALS_PATH = path.join(
  os.homedir(),
  '.k3img',
  'credentials.json'
)

function localCredentialsPath(): string {
  return path.resolve(process.cwd(), '.k3img', 'credentials.json')
}

function pathOf(scope: CredentialScope): string {
  return scope === 'local' ? localCredentialsPath() : GLOBAL_CREDENTIALS_PATH
}

function readFrom(filePath: string): StoredCredentials | null {
  if (!fs.existsSync(filePath)) return null

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw) as Partial<StoredCredentials>

    if (!data.SESSDATA || !data.bili_jct || !data.expireAt) return null
    if (Date.now() >= data.expireAt) return null

    return data as StoredCredentials
  } catch {
    // 文件损坏/格式不对，当作没有缓存处理
    return null
  }
}

/**
 * 读取凭证：本地目录优先，本地没有或已过期时，退回读取全局缓存。
 */
export function readCredentials(): StoredCredentials | null {
  return readFrom(localCredentialsPath()) ?? readFrom(GLOBAL_CREDENTIALS_PATH)
}

export function saveCredentials(
  credentials: { SESSDATA: string; bili_jct: string },
  scope: CredentialScope
): void {
  const filePath = pathOf(scope)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  const data: StoredCredentials = {
    ...credentials,
    expireAt: Date.now() + CREDENTIAL_TTL
  }

  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

export function clearCredentials(scope: CredentialScope): void {
  const filePath = pathOf(scope)
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath)
  }
}
