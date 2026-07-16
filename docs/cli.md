# 全局 CLI 配置指南

[English](./cli.md) · [简体中文](./cli_zh.md)

这份文档介绍如何把 `k3img` 装成全局命令，让你在电脑任意目录下都能运行它，而不只是在这个项目仓库里。

## 原理

`bin/k3img.mjs` 是一个转发脚本：它会去找这个仓库自己 `node_modules` 里的 `tsx`，用它执行 `scripts/upload.ts`，并把你传入的所有参数原样转发过去。`pnpm link --global` 做的事，是在 pnpm 的全局 bin 目录下建一个指回这个文件的软链接——仓库本身不会被复制到别处。

**这意味着克隆下来的仓库文件夹必须留在原地**，如果你把它挪走或删掉，全局的 `k3img` 命令就会失效。如果你想要一个完全独立、不依赖仓库位置的可执行文件，需要额外的构建打包步骤，这份文档不涉及。

## 配置步骤

```bash
git clone <this-repo-url>
cd k3img-uploader
pnpm install
chmod +x bin/k3img.mjs
pnpm link --global
```

`chmod +x` 只在 macOS/Linux 上需要，Windows 可以跳过这一步。

### 确认全局 bin 目录在 PATH 里

```bash
pnpm config get global-bin-dir
```

如果这个目录不在你的终端 `PATH` 里，执行：

```bash
pnpm setup
```

然后重启终端（或者 `source` 一下你的 shell 配置文件，比如 `~/.zshrc`、`~/.bashrc`），让改动生效。

### 验证

```bash
which k3img   # 应该指向你克隆的仓库里的 bin/k3img.mjs
```

## 用法

```bash
k3img -f avatar.png              # 上传单个文件
k3img -d ./images                # 扫描目录，交互式选择要上传的文件
k3img -f avatar.png --concurrency 5
k3img -f avatar.png -o records.json
```

`k3img --help` 可以看到完整的参数列表。

## 登录凭证

第一次运行 `k3img`（或者缓存的凭证已经过期时），会在终端弹出二维码，用 B 站 APP 扫码登录。

扫码成功后，会询问凭证缓存到哪里：

| 位置         | 路径                        | 说明                               |
| ------------ | --------------------------- | ---------------------------------- |
| 本地（默认） | `./.k3img/credentials.json` | 只对你运行命令时所在的那个目录生效 |
| 全局         | `~/.k3img/credentials.json` | 在任意目录下都能读到               |

读取缓存时，**本地优先，本地没有再找全局**——当前目录下如果有本地缓存，会优先使用。

凭证有效期是 **7 天**，和服务端登录 Cookie 的有效期保持一致。

### 跳过选择框

传 `--cache local` 或 `--cache global` 可以跳过交互式选择（方便脚本化场景）：

```bash
k3img -f avatar.png --cache global
```

## 卸载

```bash
pnpm unlink --global
```

## 常见问题

**提示 `k3img: command not found`** —— 说明全局 bin 目录没加进 `PATH`，执行 `pnpm setup` 后重启终端。

**命令能跑但立刻报错** —— 确认仓库里已经执行过 `pnpm install`，并且自从 `pnpm link --global` 之后，仓库文件夹没有被挪动或删除过。
