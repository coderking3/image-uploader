# Image Uploader

[English](./README.md) · [简体中文](./README_zh.md)

一个基于 [Nitro](https://nitro.build) 构建的轻量图片上传服务，后端接的是第三方图床接口。扫码登录一次之后，可以通过 REST API、项目内 CLI、或者装到全局随处可用的 CLI 命令三种方式上传图片。

## 特性

- **扫码登录** —— 用 bilibili APP 扫码，不需要手动复制 Cookie
- **REST API** —— `POST /api/upload` 支持程序化调用，基于 Cookie 鉴权
- **CLI 上传** —— 支持单文件/整个目录批量上传，带并发控制和进度条

## 环境要求

- Node.js 18 及以上
- [pnpm](https://pnpm.io)（较新版本即可）

## 快速开始

```bash
git clone <this-repo-url>
cd image-uploader
pnpm install
pnpm dev
```

开发服务器启动后，浏览器打开根路径能看到实时的接口文档页面。

## API

| 方法   | 路径                           | 说明                                           |
| ------ | ------------------------------ | ---------------------------------------------- |
| `GET`  | `/api/qrcode/generate`         | 生成登录二维码                                 |
| `GET`  | `/api/qrcode/poll?qrcode_key=` | 轮询扫码状态，成功后写入登录凭证 Cookie        |
| `GET`  | `/api/myinfo`                  | 获取当前登录账号信息                           |
| `POST` | `/api/upload`                  | 上传图片，`multipart/form-data`，字段名 `file` |

## CLI

### 项目内使用

在这个仓库里直接跑，不需要额外配置：

```bash
pnpm upload -f avatar.png
pnpm upload -d ./images
```

`pnpm upload --help` 可以看到所有可用参数。

### 全局命令

想在电脑任意目录下都能跑 `k3img`，而不只是在这个项目里？看专门的 [全局 CLI 配置指南](./docs/cli.zh-CN.md)。

## 部署

```bash
pnpm build
```

项目当前配置的部署目标是 `vercel`（见 `nitro.config.ts`）。其他部署方式可以参考 [Nitro 部署文档](https://nitro.build/deploy)。

## License

见 [LICENSE](./LICENSE)。
