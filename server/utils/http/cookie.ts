type CookieInput = string | string[]

function toLines(input: CookieInput): string[] {
  if (typeof input === 'string') {
    // 单个字符串：Cookie 请求头格式 "a=1; b=2"，需要自己切分
    return input.split(';').map((s) => s.trim())
  }
  return input
}

export function pickCookie(input: CookieInput, name: string): string | undefined
export function pickCookie(
  input: CookieInput,
  names: string[]
): (string | undefined)[]
export function pickCookie(
  input: CookieInput,
  nameOrNames: string | string[]
): string | undefined | (string | undefined)[] {
  const lines = toLines(input)

  const pickOne = (name: string): string | undefined => {
    const raw = lines.find((line) => line.startsWith(`${name}=`))
    if (!raw) return undefined

    const [pair = ''] = raw.split(';')
    return pair.slice(name.length + 1)
  }

  if (Array.isArray(nameOrNames)) {
    return nameOrNames.map(pickOne)
  }

  return pickOne(nameOrNames)
}
