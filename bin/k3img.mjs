#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// __dirname 指向这个文件在磁盘上的真实位置（也就是项目仓库里的 bin/ 目录），
// 和用户当前在哪个目录下敲命令（process.cwd()）无关——
// `pnpm link --global` 只是在全局 bin 目录建了个指回这里的软链接，
// 文件本身还留在项目仓库里，所以这里能稳定找到项目自己的 node_modules。
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const tsxBin = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
)
const entry = path.join(projectRoot, 'scripts', 'upload.ts')

// 特意不传 cwd 选项：子进程默认继承父进程（也就是用户实际所在）的工作目录，
// 这样 `k3img -f ./avatar.png` 里的相对路径才会按用户当前所在目录解析，
// 而不是被错误地解析成相对于项目仓库的路径
const child = spawn(tsxBin, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit'
})

child.on('error', (err) => {
  console.error('k3img 启动失败:', err.message)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
