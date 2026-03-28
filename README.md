# QingKuai

Qingkuai is a lightweight, fast, and developer-friendly frontend framework designed for modern web applications. It features a template-first syntax and a minimal runtime, producing compiled output that’s only `20%` to `50%` the size of comparable mainstream frameworks—without compromising on power or expressiveness. Whether you’re building small components or full-featured apps, Qingkuai delivers a smooth and efficient development experience with minimal overhead.

[Documentation](https://qingkuai.dev) | [Playground](https://try.qingkuai.dev) | [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=qingkuai-tools.qingkuai-language-features) | [Issues](https://github.com/qingkuai-js/qingkuai/issues)

## Packages

| Package             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `qingkuai`          | Runtime package with core rendering logic        |
| `qingkuai/compiler` | Compiler for transforming component files        |
| `qingkuai/internal` | Internal helpers used by the compiler (no types) |

## Getting started

To quickly try QingKuai in a new project, run:

```shell
npm create qingkuai -- "my-qingkuai-app"
cd ./my-qingkuai-app
npm install
npm run dev
```

## Contributes

To contribute to QingKuai itself, clone the repository and start the development server:

```shell
git clone https://github.com/qingkuai-js/qingkuai.git
cd qingkuai
pnpm install
pnpm run dev
```

## License

MIT © 2024-present, all contributors to qingkuai
