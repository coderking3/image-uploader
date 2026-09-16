# k3img 全局 CLI 使用指南

把本仓库注册为全局命令后，可以在任意目录运行 `k3img` 上传图片。只在仓库内使用时，无须全局注册，直接运行 `pnpm upload -f avatar.png`。

## 准备

- 安装 Node.js 20.12 或更新版本，以及 [pnpm](https://pnpm.io/installation)。Node.js 自带的 npm 用于注册全局命令。
- 下载或克隆本仓库，并记住 `image-uploader` 文件夹的位置。下文的路径只是示例，请换成你的实际路径。

本指南使用 [`npm link`](https://docs.npmjs.com/cli/v11/commands/npm-link/) 创建全局命令。[pnpm 11 起已移除 `pnpm link --global`](https://pnpm.io/cli/link)，因此安装项目依赖用 pnpm，全局注册用 npm。

## Windows (PowerShell)

在 PowerShell 中运行：

```powershell
Set-Location 'C:\path\to\image-uploader'
pnpm install
npm link
```

打开一个新的 PowerShell 窗口，验证命令：

```powershell
Get-Command k3img
k3img --help
```

`Get-Command` 应显示全局命令的路径，`--help` 应显示上传参数。若 PowerShell 提示禁止运行 `.ps1`，可将上面的命令分别写成 `pnpm.cmd`、`npm.cmd` 和 `k3img.cmd`。

## macOS

在终端中运行：

```bash
cd /path/to/image-uploader
pnpm install
chmod +x bin/k3img.mjs
npm link
```

打开一个新终端，验证命令：

```bash
command -v k3img
k3img --help
```

`command -v` 应输出全局命令的路径，`--help` 应显示上传参数。

## 上传图片

以下命令在 macOS 和 Windows 中相同。相对文件路径以运行 `k3img` 时所在的目录为起点。

```text
k3img -f avatar.png
k3img -d ./images
k3img -f avatar.png --concurrency 5
k3img -f avatar.png -o records.json
```

`-f` 上传单个文件；`-d` 扫描目录并让你选择图片。`-o` 指定上传记录的 JSON 文件；上传成功后会询问是否保存。运行 `k3img --help` 可查看完整参数。

目录模式会列出找到的图片，默认全部选中。用方向键移动、空格键切换选择、`a` 全选或清空、`i` 反选、回车键确认；按 `Ctrl+C` 可取消操作。上传进度和结果会在同一套终端界面中显示，图片链接保留完整内容，便于复制。

上传命令需要交互式终端；即使使用 `--cache` 跳过登录凭证保存位置的选择，成功上传后仍会询问是否保存记录。

## 登录凭证

首次上传或缓存过期时，终端会显示二维码，使用 B 站 APP 扫码登录。登录成功后，CLI 会询问凭证保存位置：

| 位置         | 路径                                   | 适用范围     |
| ------------ | -------------------------------------- | ------------ |
| 本地（默认） | 当前目录的 `.k3img/credentials.json`   | 当前工作目录 |
| 全局         | 用户主目录的 `.k3img/credentials.json` | 任意工作目录 |

读取时先检查当前目录的缓存；本地缓存不存在或过期时，再检查全局缓存。缓存有效期为 7 天。`--cache local` 或 `--cache global` 可以跳过**新登录后的保存位置**选择，但不会改变读取顺序。

```text
k3img -f avatar.png --cache global
```

## 维护与排错

**移除全局命令：**运行 `npm uninstall -g image-uploader`。这不会删除仓库文件夹或登录凭证。

**找不到 `k3img`：**先在仓库中重新运行 `npm link`，再打开新终端。仍找不到时，运行 `npm prefix -g` 查看 npm 全局目录，并确认其命令目录在 `PATH` 中：macOS 为该目录下的 `bin`，Windows 为该目录本身。

**命令启动失败：**确认在仓库中执行过 `pnpm install`。全局命令指向当前仓库；移动或删除仓库后，请在新位置重新运行 `npm link`。
