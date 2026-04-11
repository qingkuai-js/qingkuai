# Contributing to QingKuai

## Setup

```shell
git clone https://github.com/qingkuai-js/qingkuai.git
cd qingkuai
pnpm install
```

## Development

```shell
pnpm run dev       # watch mode, rebuilds on file changes
pnpm run bundle    # single build
```

## Testing

```shell
pnpm run test:units   # unit tests
pnpm run test:e2e     # E2E tests (requires a build)
pnpm run typecheck    # TypeScript type check
pnpm run lint         # ESLint
```

## Submitting Changes

1. Fork the repository and create a branch from `dev`.
2. Make your changes and ensure all tests pass.
3. Open a pull request targeting the `dev` branch.

For bug reports or feature requests, please [open an issue](https://github.com/qingkuai-js/qingkuai/issues).
