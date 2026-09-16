import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { uploadImage } from '#server/utils/upload'
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  outro,
  progress,
  spinner
} from '@clack/prompts'
import { defineCommand, runMain } from 'citty'
import fg from 'fast-glob'
import { imageSize } from 'image-size'
import pLimit from 'p-limit'
import { UUID } from 'uuidjs'

import { ensureLogin } from './auth/login'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
const SUPPORTED_TYPES = new Set(IMAGE_EXTENSIONS)
const DEFAULT_OUTPUT = '.output/upload-images.json'
const DEFAULT_CONCURRENCY = 3

interface ImageFile {
  path: string
  name: string
  size: number
  width: number
  height: number
  type: string
}

interface UploadRecord {
  id: string
  name: string
  url: string
  width: number
  height: number
  type: string
  date: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function characterWidth(char: string): number {
  if (char === '\u200D' || /\p{Mark}/u.test(char)) return 0
  if (
    /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6]/u.test(
      char
    ) ||
    /\p{Extended_Pictographic}/u.test(char)
  ) {
    return 2
  }
  return 1
}

function shortenFileLabel(label: string): string {
  const maxWidth = Math.max(
    12,
    Math.min(60, (process.stdout.columns ?? 80) - 34)
  )
  const chars = Array.from(label)
  if (
    chars.reduce((width, char) => width + characterWidth(char), 0) <= maxWidth
  ) {
    return label
  }

  let suffix = ''
  let width = 1 // 省略号
  for (const char of chars.reverse()) {
    const nextWidth = characterWidth(char)
    if (width + nextWidth > maxWidth) break
    suffix = char + suffix
    width += nextWidth
  }
  return `…${suffix}`
}

function readImageFile(filePath: string): ImageFile | null {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const type = ext === 'jpeg' ? 'jpg' : ext

  if (!SUPPORTED_TYPES.has(type)) return null

  const stat = fs.statSync(filePath)
  if (!stat.isFile()) return null

  try {
    const buffer = fs.readFileSync(filePath)
    const size = imageSize(buffer)

    if (!size.width || !size.height) return null

    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      width: size.width,
      height: size.height,
      type
    }
  } catch {
    // 不是合法图片（比如扩展名对但内容损坏），跳过
    return null
  }
}

function collectSingleFile(filePath: string): ImageFile {
  const resolved = path.resolve(filePath)

  if (!fs.existsSync(resolved)) {
    throw new Error(`文件不存在: ${resolved}`)
  }

  const image = readImageFile(resolved)

  if (!image) {
    throw new Error(
      `不是受支持的图片: ${resolved}（支持 ${IMAGE_EXTENSIONS.join('/')}）`
    )
  }

  return image
}

async function collectDirectoryFiles(dirValue: string): Promise<ImageFile[]> {
  const dirPath = path.resolve(dirValue)

  if (!fs.existsSync(dirPath)) {
    throw new Error(`目录不存在: ${dirPath}`)
  }

  const pattern = IMAGE_EXTENSIONS.map((ext) => `**/*.${ext}`)
  const filePaths = await fg(pattern, {
    cwd: dirPath,
    absolute: true,
    caseSensitiveMatch: false
  })

  const images = filePaths
    .map((f) => readImageFile(f))
    .filter((f): f is ImageFile => f !== null)

  if (images.length === 0) {
    throw new Error('目录下没有找到受支持的图片文件')
  }

  log.info(
    `找到 ${images.length} 张图片\n↑↓ 移动 · 空格选择 · a 全选/清空 · i 反选 · 回车确认`
  )

  const selected = await multiselect<ImageFile>({
    message: '选择要上传的图片',
    options: images.map((image) => ({
      label: shortenFileLabel(path.relative(dirPath, image.path)),
      hint: `${image.width}×${image.height} · ${formatBytes(image.size)}`,
      value: image
    })),
    initialValues: images,
    maxItems: 8,
    required: false,
    showInstructions: false
  })

  if (isCancel(selected)) {
    cancel('已取消上传')
    process.exit(0)
  }

  return selected
}

function readExistingRecords(outputPath: string): UploadRecord[] {
  if (!fs.existsSync(outputPath)) return []

  const raw = fs.readFileSync(outputPath, 'utf8').trim()
  if (!raw) return []

  const data = JSON.parse(raw)
  if (!Array.isArray(data)) {
    throw new TypeError(`输出文件不是 JSON 数组: ${outputPath}`)
  }

  return data as UploadRecord[]
}

function saveRecords(outputValue: string, records: UploadRecord[]): void {
  const outputPath = path.resolve(outputValue)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  const existing = readExistingRecords(outputPath)
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify([...existing, ...records], null, 2)}\n`
  )
}

const main = defineCommand({
  meta: { name: 'upload', description: '上传图片到 B 站图床' },
  args: {
    f: { type: 'string', description: '指定单个文件' },
    d: { type: 'string', description: '扫描目录下所有图片' },
    cache: {
      type: 'string',
      description: '凭证缓存位置: local | global，不传则交互式选择'
    },
    o: {
      type: 'string',
      description: '保存 JSON 记录的路径',
      default: DEFAULT_OUTPUT
    },
    concurrency: {
      type: 'string',
      description: '并发上传数',
      default: String(DEFAULT_CONCURRENCY)
    }
  },
  async run({ args }) {
    if (process.stdout.isTTY) process.stdout.write('\n')
    intro('k3img · 图片上传')
    try {
      if (args.cache && args.cache !== 'local' && args.cache !== 'global') {
        throw new Error('--cache 只能是 local 或 global')
      }

      if (args.f && args.d) {
        throw new Error('参数冲突：-f 和 -d 只能选择一个')
      }

      if (!args.f && !args.d) {
        throw new Error('请使用 -f <文件> 或 -d <目录>')
      }

      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error('请在交互式终端运行 k3img')
      }

      const selected: ImageFile[] = args.f
        ? [collectSingleFile(args.f)]
        : await collectDirectoryFiles(args.d!)
      if (selected.length === 0) {
        outro('未选择图片')
        return
      }

      log.info(`待上传 ${selected.length} 张图片`)

      // 优先读本地缓存的登录凭证，没有或过期才走终端扫码登录
      const credentials = await ensureLogin(
        args.cache as 'local' | 'global' | undefined
      )

      const concurrency = Math.max(
        1,
        Number(args.concurrency) || DEFAULT_CONCURRENCY
      )
      const limit = pLimit(concurrency)
      const uploadProgress =
        selected.length > 1 ? progress({ max: selected.length }) : null
      const uploadSpinner = uploadProgress ? null : spinner()
      uploadProgress?.start('正在上传图片')
      uploadSpinner?.start('正在上传图片')

      let completed = 0
      const results = await Promise.allSettled(
        selected.map((file) =>
          limit(async () => {
            const buffer = fs.readFileSync(file.path)

            // 核心上传逻辑和 server/api/upload.post.ts 共用同一个纯函数，
            // 这里不再重复实现一遍 formdata 拼装 / 请求 bilibili 接口的逻辑
            const result = await uploadImage(
              { data: buffer, filename: file.name },
              credentials
            )

            const record: UploadRecord = {
              id: UUID.generate(),
              name: file.name,
              url: result.location,
              width: file.width,
              height: file.height,
              type: file.type,
              date: Date.now()
            }

            return { file, record }
          }).finally(() => {
            completed += 1
            uploadProgress?.advance(1, `已处理 ${completed}/${selected.length}`)
          })
        )
      )

      uploadProgress?.stop('上传处理完成')
      uploadSpinner?.stop('上传处理完成')

      const succeeded = results.filter(
        (
          result
        ): result is PromiseFulfilledResult<{
          file: ImageFile
          record: UploadRecord
        }> => result.status === 'fulfilled'
      )
      const failed = results.flatMap((result, index) =>
        result.status === 'rejected'
          ? [{ file: selected[index]!, reason: result.reason }]
          : []
      )
      const fileLabel = (file: ImageFile) =>
        args.d ? path.relative(path.resolve(args.d), file.path) : file.name

      if (failed.length > 0) {
        log.warn(`上传结束 · 成功 ${succeeded.length}，失败 ${failed.length}`)
      } else {
        log.success(`上传完成 · 成功 ${succeeded.length} 张`)
      }

      if (succeeded.length > 0) {
        log.step('图片链接')
        for (const { file, record } of succeeded.map(
          (result) => result.value
        )) {
          log.message(`${fileLabel(file)}\n${record.url}`)
        }
      }

      if (failed.length > 0) {
        log.step('失败文件')
        for (const { file, reason } of failed) {
          log.error(
            `${fileLabel(file)}：${reason instanceof Error ? reason.message : String(reason)}`
          )
        }
      }

      if (succeeded.length > 0) {
        log.info(`记录文件：${path.resolve(args.o)}`)
        const shouldSave = await confirm({
          message: '保存成功记录？',
          active: '保存',
          inactive: '跳过',
          initialValue: true
        })

        if (isCancel(shouldSave)) {
          cancel('已取消保存')
          process.exit(0)
        }

        if (shouldSave) {
          saveRecords(
            args.o,
            succeeded.map((result) => result.value.record)
          )
          log.success(`已保存 ${succeeded.length} 条记录`)
        }
      }

      outro('完成')
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err))
      outro('未完成')
      process.exitCode = 1
    }
  }
})

runMain(main)
