# Qingkuai

<a href="https://qingkuai.dev">
   <img src="https://raw.githubusercontent.com/qingkuai-js/qingkuai/1e1ae0e5517418b4f193c230541538444061604b/assets/banner-light.svg" alt="qingkuai banner" /> 
</a>

[![CI](https://github.com/qingkuai-js/qingkuai/actions/workflows/ci.yml/badge.svg)](https://github.com/qingkuai-js/qingkuai/actions/workflows/ci.yml)
[![E2E Nightly](https://github.com/qingkuai-js/qingkuai/actions/workflows/e2e-nightly.yml/badge.svg)](https://github.com/qingkuai-js/qingkuai/actions/workflows/e2e-nightly.yml)
[![codecov](https://codecov.io/gh/qingkuai-js/qingkuai/branch/main/graph/badge.svg?flag=compiler&metric=lines)](https://codecov.io/gh/qingkuai-js/qingkuai)
[![E2E Scenarios](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/qingkuai-js/qingkuai/e2e-badge/badges/e2e-scenarios.json)](https://github.com/qingkuai-js/qingkuai/tree/main/tests/e2e)

Qingkuai is a compiler-based frontend framework for building web interfaces. It transforms `.qk` source files into minimal, strictly optimized JavaScript.

Learn more at [Qingkuai Docs](https://qingkuai.dev), or try it out in the [Playground](https://try.qingkuai.dev).

## Why Qingkuai

- **Architecture**: Compile-time checking & performance optimization, fine-grained updates.
- **Bundle Size**: Runtime only 5KB–11KB (gzip), compiled size [20%–80%](https://mlgq.github.io/frontend-framework-bundle-size/?lang=en) of other frameworks.
- **Reactivity**: Full [reactive support](https://qingkuai.dev/basic/reactivity.html#reactivity-declaration) with [compiler-auto-inferred](https://qingkuai.dev/references/reactivity-infer-rules.html), no manual handling needed.
- **Developer Experience**: Native JS/TS-like experience inside script blocks, Try in [Palyground](https://try.qingkuai.dev).
- **Debugging Experience**: Enhanced [debugging](https://qingkuai.dev/misc/debugging.html) with source-matched and directive context identifiers.
- **Language Services & AI**: Full [language services](https://marketplace.visualstudio.com/items?itemName=qingkuai-tools.qingkuai-language-features) and [mcp server](https://www.npmjs.com/package/qingkuai-mcp-server) for better AI-assisted development.

## Quick Start

```bash
npm create qingkuai qingkuai-app
cd qingkuai-app
npm install && npm run dev
```

## CLI

The official CLI (`@qingkuai/cli`) ships the whole toolchain — vite, TypeScript, Prettier (with `prettier-plugin-qingkuai`) and the Qingkuai language service are bundled at pinned versions and pre-wired into every command, so it works with zero configuration.

```bash
npm install -g @qingkuai/cli
qingkuai --help
```

| Command                      | Description                                                               |
| ---------------------------- | ------------------------------------------------------------------------- |
| `qingkuai init [name]`       | Scaffold a new Qingkuai application (`--ts` for the TypeScript template)  |
| `qingkuai dev`               | Start the vite dev server with HMR                                        |
| `qingkuai build`             | Build a Qingkuai application or library into distributable files          |
| `qingkuai preview`           | Serve the build output directory via vite's preview server                |
| `qingkuai check [files...]`  | Perform syntax or type checking (`--types`) on `.qk` and TypeScript files |
| `qingkuai build-types [dir]` | Type-check and emit declaration files (`.d.ts`)                           |
| `qingkuai format [files...]` | Format Qingkuai component files or other Prettier-supported files         |

Run `qingkuai <command> --help` for the full list of flags and examples, or see the [CLI reference](https://qingkuai.dev/misc/cli.html).

## MCP Server

[qingkuai-mcp-server](https://www.npmjs.com/package/qingkuai-mcp-server) equips AI agents with Qingkuai-aware tools: syntax documentation search, syntax checking, compilation, and code formatting for `.qk` files.

For example, add it to `.vscode/mcp.json` to use it with VS Code Copilot agent mode:

```json
{
    "servers": {
        "qingkuai": {
            "type": "stdio",
            "command": "npx",
            "args": ["qingkuai-mcp-server@latest"]
        }
    }
}
```

It works with any MCP-compatible host (Claude Desktop, Cursor, etc.). See the [package README](https://www.npmjs.com/package/qingkuai-mcp-server) for the full tool list and per-host configurations.

## Js Framework Benchmark

[![js-framework-benchmark-report](https://raw.githubusercontent.com/qingkuai-js/qingkuai/1e1ae0e5517418b4f193c230541538444061604b/assets/js-framework-benchmark.png)](https://krausest.github.io/js-framework-benchmark/2026/chrome148.html)

## Bundle Size Report

[![bundle-size-report](https://raw.githubusercontent.com/qingkuai-js/qingkuai/1e1ae0e5517418b4f193c230541538444061604b/assets/bundle-size-report.png)](https://mlgq.github.io/frontend-framework-bundle-size/?lang=en)

## Contributing

Please see the [Contributing Guide](CONTRIBUTING.md) for details on how to contribute to QingKuai.

## License

[MIT](LICENSE) © 2024-present, all contributors to qingkuai
