# Qingkuai

<p>
    <img src="https://github.com/qingkuai-js/qingkuai/blob/main/design/banner.svg" alt="qingkuai banner" />
</p>

[![npm](https://img.shields.io/npm/v/qingkuai.svg)](https://www.npmjs.com/package/qingkuai)
[![License](https://img.shields.io/npm/l/qingkuai.svg)](LICENSE)
[![CI](https://github.com/qingkuai-js/qingkuai/actions/workflows/ci.yml/badge.svg)](https://github.com/qingkuai-js/qingkuai/actions/workflows/ci.yml)
[![E2E Nightly](https://github.com/qingkuai-js/qingkuai/actions/workflows/e2e-nightly.yml/badge.svg)](https://github.com/qingkuai-js/qingkuai/actions/workflows/e2e-nightly.yml)

Qingkuai is a compiler-based frontend framework for building web interfaces. It transforms `.qk` source files into minimal, strictly optimized JavaScript.

Learn more at [Qingkuai Docs](https://qingkuai.dev), or try it out in the [Playground](https://try.qingkuai.dev).

## Why Qingkuai

1. **Architecture**: Compile-time checking & performance optimization, fine-grained updates.
2. **Bundle Size**: Runtime only 5KB–11KB (gzip), compiled size [20%–80%](https://mlgq.github.io/frontend-framework-bundle-size/?lang=en) of other frameworks.
3. **Reactivity**: Full [reactive support](https://qingkuai.dev/basic/reactivity.html#reactivity-declaration) with [compiler-auto-inferred](https://qingkuai.dev/references/reactivity-infer-rules.html), no manual handling needed.
4. **Developer Experience**: Native JavaScript/TypeScript-like experience inside script blocks, Try in [Palyground](https://try.qingkuai.dev).
5. **Debugging Experience**: Generated source-matching and directive context identifiers for improving [debugging](https://qingkuai.dev/misc/debugging.html) experience.
6. **Language Services & AI**: Full component [language services](https://marketplace.visualstudio.com/items?itemName=qingkuai-tools.qingkuai-language-features) plus [MCP Server](https://www.npmjs.com/package/qingkuai-mcp-server) for better AI understanding and generation quality.

## Quick Start

```bash
npm run create qingkuai my-app && cd ./my-app
npm install && npm run dev
```

## Contributing

Please see the [Contributing Guide](CONTRIBUTING.md) for details on how to contribute to QingKuai.

## License

[MIT](LICENSE) © 2024-present, all contributors to qingkuai
