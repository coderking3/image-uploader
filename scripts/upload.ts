import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { checkbox, confirm } from '@inquirer/prompts'
import { defineCommand, runMain } from 'citty'
// cli-progress 是 default export，之前 `import { cliProgress }` 是错的，运行时会报错
import cliProgress from 'cli-progress'
import fg from 'fast-glob'
import { imageSize } from 'image-size'
import pLimit from 'p-limit'
import { UUID } from 'uuidjs'

import { uploadImage } from '#/utils/upload'

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

  const selected = await checkbox({
    message: `在 ${dirPath} 下找到 ${images.length} 个文件，选择要上传的（空格选择，回车确认）：`,
    choices: images.map((image) => ({
      name: `${path.relative(dirPath, image.path)} (${image.width}x${
        image.height
      }, ${formatBytes(image.size)})`,
      value: image,
      checked: true
    })),
    pageSize: 15
  })

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

  console.log(`已保存 ${records.length} 条记录到: ${outputPath}`)
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
    if (args.cache && args.cache !== 'local' && args.cache !== 'global') {
      console.error('--cache 只能是 local 或 global')
      process.exit(1)
    }

    if (args.f && args.d) {
      console.error('参数冲突: -f 和 -d 只能选择一个')
      process.exit(1)
    }

    if (!args.f && !args.d) {
      console.error('请使用 -f <文件> 或 -d <目录>')
      process.exit(1)
    }

    let selected: ImageFile[]

    try {
      selected = args.f
        ? [collectSingleFile(args.f)]
        : await collectDirectoryFiles(args.d!)
    } catch (err) {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    }

    if (selected.length === 0) {
      console.log('未选择任何文件，退出')
      return
    }

    // 优先读本地缓存的登录凭证，没有或过期才走终端扫码登录
    const credentials = await ensureLogin(
      args.cache as 'local' | 'global' | undefined
    )

    const concurrency = Math.max(
      1,
      Number(args.concurrency) || DEFAULT_CONCURRENCY
    )
    const limit = pLimit(concurrency)

    const bar = new cliProgress.SingleBar(
      {},
      cliProgress.Presets.shades_classic
    )
    bar.start(selected.length, 0)

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

          bar.increment()

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
        })
      )
    )

    bar.stop()

    const succeeded = results.filter(
      (
        r
      ): r is PromiseFulfilledResult<{
        file: ImageFile
        record: UploadRecord
      }> => r.status === 'fulfilled'
    )
    const failed = results.filter((r) => r.status === 'rejected')

    console.log(`\n上传完成: 成功 ${succeeded.length} / 失败 ${failed.length}`)

    if (succeeded.length > 0) {
      console.log('\n成功文件:')
      for (const { file, record } of succeeded.map((r) => r.value)) {
        console.log(`  - ${file.name}: ${record.url}`)
      }
    }

    if (failed.length > 0) {
      console.log('\n失败文件:')
      failed.forEach((r) => {
        if (r.status === 'rejected') console.log(`  - ${r.reason}`)
      })
    }

    if (succeeded.length === 0) return

    const shouldSave = await confirm({
      message: `是否保存 ${succeeded.length} 条成功记录到 ${args.o}？`,
      default: true
    })

    if (shouldSave) {
      saveRecords(
        args.o,
        succeeded.map((r) => r.value.record)
      )
    }
  }
})

runMain(main)
