# Changelog

## [1.0.67](https://github.com/qingkuai-js/qingkuai/compare/v1.0.66...v1.0.67) (2026-05-19)

### Features

- **compiler(check):** adjust generated component export intermediate code format and add `ComponentInstance` type export for language service compatibility ([b3ff895](https://github.com/qingkuai-js/qingkuai/commit/b3ff895))
- **compiler:** normalize component tag format by disallowing hyphens when using member expressions as component tags, and remove `parseComponentTag` ([1099cd3](https://github.com/qingkuai-js/qingkuai/commit/1099cd3), [be2155f](https://github.com/qingkuai-js/qingkuai/commit/be2155f))

### Tests

- **unit:** add tests to ensure component tags cannot mix dots and hyphens ([1099cd3](https://github.com/qingkuai-js/qingkuai/commit/1099cd3))
- **e2e:** enhance consistency checks for component tags and component props across different syntaxes ([513c42e](https://github.com/qingkuai-js/qingkuai/commit/513c42e))

## [1.0.66](https://github.com/qingkuai-js/qingkuai/compare/v1.0.65...v1.0.66) (2026-05-17)

### Features

- **runtime, compiler:** rename `&dom` to `&handle` and support accessing component instance handles ([18a73e0](https://github.com/qingkuai-js/qingkuai/commit/18a73e0), [fc47939](https://github.com/qingkuai-js/qingkuai/commit/fc47939))
- **compiler:** support `export` syntax in component files and expose exports on the component instance ([7fdade9](https://github.com/qingkuai-js/qingkuai/commit/7fdade9))
- **compiler(check):** provide explicit reasons when inferred identifiers are considered non-reactive ([8c47ce6](https://github.com/qingkuai-js/qingkuai/commit/8c47ce6))
- **runtime:** export package version from `qingkuai` runtime (`version`) ([0ca6098](https://github.com/qingkuai-js/qingkuai/commit/0ca6098))
- **compiler:** generate source maps before and after interpolation block transforms to improve debugging experience ([8bee953](https://github.com/qingkuai-js/qingkuai/commit/8bee953))

### Fixes

- **runtime:** correctly reset `currentInstance` when directive handlers are re-executed ([c0a6fef](https://github.com/qingkuai-js/qingkuai/commit/c0a6fef))
- **compiler:** correctly transform reactive identifier access inside arrow functions ([7981fab](https://github.com/qingkuai-js/qingkuai/commit/7981fab))

### Tests

- **unit:** add error and transform tests for `export` support ([c550d49](https://github.com/qingkuai-js/qingkuai/commit/c550d49))
- **unit:** add transform tests for reactive identifier access inside arrow functions ([7981fab](https://github.com/qingkuai-js/qingkuai/commit/7981fab))
- **unit:** add tests for compiler check-mode reasons on non-reactive identifier inference ([8c47ce6](https://github.com/qingkuai-js/qingkuai/commit/8c47ce6))
- **e2e:** add tests for `currentInstance` when directive handlers are re-run ([cc6e835](https://github.com/qingkuai-js/qingkuai/commit/cc6e835))
- **e2e:** add tests for component instance access via `&handle` and exported value access from instances ([7fdade9](https://github.com/qingkuai-js/qingkuai/commit/7fdade9))

## [1.0.65](https://github.com/qingkuai-js/qingkuai/compare/v1.0.64...v1.0.65) (2026-04-27)

### Fixes

- **runtime:** ensure `splice` insert operations trigger side effects (updated unit tests) ([1422f55](https://github.com/qingkuai-js/qingkuai/commit/1422f55))
- **runtime:** remove DOM attributes when value is `null`/`undefined` (updated e2e tests) ([f82b455](https://github.com/qingkuai-js/qingkuai/commit/f82b455))
- **compiler:** fix reactivity inference mismatch for mutable identifiers accessed in reference attributes ([2efc2c0](https://github.com/qingkuai-js/qingkuai/commit/2efc2c0))

### Tests

- **e2e:** add SVG-related end-to-end tests ([f82b455](https://github.com/qingkuai-js/qingkuai/commit/f82b455))
- **e2e:** add boundary coverage for DOM attribute behavior ([1c16f6c](https://github.com/qingkuai-js/qingkuai/commit/1c16f6c))
- **e2e:** add tests for reactivity inference of mutable identifiers in reference attributes ([2efc2c0](https://github.com/qingkuai-js/qingkuai/commit/2efc2c0))

## [1.0.64](https://github.com/qingkuai-js/qingkuai/v1.0.64) (2026-04-17)

### Changes

- **runtime:** remove `onBeforeMount` lifecycle hook API ([9b5d115](https://github.com/qingkuai-js/qingkuai/commit/9b5d115))

### Refactors

- **runtime, compiler:** debugging identifier for alias bindings now uses accessor instead of raw value ([ab178e2](https://github.com/qingkuai-js/qingkuai/commit/ab178e2))

### Tests

- **e2e:** add e2e tests for directives (if, for, await, html) ([16ce250](https://github.com/qingkuai-js/qingkuai/commit/16ce250), [4dd52fd](https://github.com/qingkuai-js/qingkuai/commit/4dd52fd), [593ae6a](https://github.com/qingkuai-js/qingkuai/commit/593ae6a), [0d4e331](https://github.com/qingkuai-js/qingkuai/commit/0d4e331), [904c9f8](https://github.com/qingkuai-js/qingkuai/commit/904c9f8))
- **e2e:** add e2e tests for component, async component, and slot functionalities ([40b226e](https://github.com/qingkuai-js/qingkuai/commit/40b226e), [d2db4c4](https://github.com/qingkuai-js/qingkuai/commit/d2db4c4), [8da3bf9](https://github.com/qingkuai-js/qingkuai/commit/8da3bf9), [6df1d6f](https://github.com/qingkuai-js/qingkuai/commit/6df1d6f))
- **e2e:** add e2e tests for form handling (select, input, textarea) ([01b30c2](https://github.com/qingkuai-js/qingkuai/commit/01b30c2), [c53d37a](https://github.com/qingkuai-js/qingkuai/commit/c53d37a))
- **e2e:** add e2e tests for event binding with various modifiers ([707d222](https://github.com/qingkuai-js/qingkuai/commit/707d222))
- **e2e:** add e2e tests for reference attribute behaviors ([40b226e](https://github.com/qingkuai-js/qingkuai/commit/40b226e))
