# Image Uploader

[English](./README.md) · [简体中文](./README.zh-CN.md)

A lightweight image upload service built on [Nitro](https://nitro.build), backed by a third-party image hosting API. Log in once via QR code, then upload images through the REST API, the project-local CLI, or a global CLI command available anywhere on your machine.

## Features

- **QR code login** — scan with the Bilibili app, no manual cookie copying
- **REST API** — `POST /api/upload` for programmatic uploads, cookie-based auth
- **CLI upload** — batch upload a file or a whole directory, with concurrency control and a progress bar

## Requirements

- Node.js 18 or later
- [pnpm](https://pnpm.io) (any recent version)

## Getting Started

```bash
git clone <this-repo-url>
cd image-uploader
pnpm install
pnpm dev
```

The dev server starts on Nitro's default port. Open the root URL in your browser to see the live API reference page.

## API

| Method | Path                           | Description                                                |
| ------ | ------------------------------ | ---------------------------------------------------------- |
| `GET`  | `/api/qrcode/generate`         | Generate a login QR code                                   |
| `GET`  | `/api/qrcode/poll?qrcode_key=` | Poll scan status; sets the auth cookie on success          |
| `GET`  | `/api/myinfo`                  | Get the currently logged-in account's info                 |
| `POST` | `/api/upload`                  | Upload an image (`multipart/form-data`, field name `file`) |

## CLI

### Project-local

Run uploads from inside this repo without any extra setup:

```bash
pnpm upload -f avatar.png
pnpm upload -d ./images
```

Run `pnpm upload --help` for all available flags.

### Global command

Want to run `k3img` from any directory, not just this repo? See the dedicated [global CLI setup guide](./docs/cli.md).

## Deploying

```bash
pnpm build
```

This project targets the `vercel` preset (see `nitro.config.ts`). See the [Nitro deployment docs](https://nitro.build/deploy) for other presets.

## License

See [LICENSE](./LICENSE).
