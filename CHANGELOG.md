# Changelog

## [1.0.82](https://github.com/qingkuai-js/qingkuai/compare/v1.0.81...v1.0.82) (2026-06-21)

### Features

- **runtime, compiler:** add `scope` directive to enhance scoped style control ([b9bfb32](https://github.com/qingkuai-js/qingkuai/commit/b9bfb32))
- **runtime, compiler:** support pass-through scope id behavior for the `scope` directive ([b9bfb32](https://github.com/qingkuai-js/qingkuai/commit/b9bfb32), [5220c32](https://github.com/qingkuai-js/qingkuai/commit/5220c32))

### Improvements

- **compiler:** remove constant declarations when rendering components and directly use component function call results ([3dd75c1](https://github.com/qingkuai-js/qingkuai/commit/3dd75c1))

### Fixes

- **compiler:** fix incorrect `Destruction` chain in directives and component calls ([b62fa39](https://github.com/qingkuai-js/qingkuai/commit/b62fa39))
- **compiler:** fix incorrect compilation result when components exist in slots ([ca0d4e4](https://github.com/qingkuai-js/qingkuai/commit/ca0d4e4))
- **compiler:** accessing imported identifiers themselves should not treat interpolation expressions as reactive ([a41e150](https://github.com/qingkuai-js/qingkuai/commit/a41e150))
- **compiler(check):** fix incorrect semicolon source map position at the end of embedded script blocks in check mode ([0476fdb](https://github.com/qingkuai-js/qingkuai/commit/0476fdb))

## [1.0.81](https://github.com/qingkuai-js/qingkuai/compare/v1.0.80...v1.0.81) (2026-06-14)

### Features

- **runtime, compiler:** add `scope` directive to enhance scoped style control ([b9bfb32](https://github.com/qingkuai-js/qingkuai/commit/b9bfb32))

### Improvements

- **compiler:** remove constant declarations when rendering components and directly use component function call results ([3dd75c1](https://github.com/qingkuai-js/qingkuai/commit/3dd75c1))

### Fixes

- **compiler:** fix incorrect `Destruction` chain in directives and component calls ([b62fa39](https://github.com/qingkuai-js/qingkuai/commit/b62fa39))
- **compiler:** fix incorrect compilation result when components exist in slots ([ca0d4e4](https://github.com/qingkuai-js/qingkuai/commit/ca0d4e4))
- **compiler:** accessing imported identifiers themselves should not treat interpolation expressions as reactive ([a41e150](https://github.com/qingkuai-js/qingkuai/commit/a41e150))

## [1.0.80](https://github.com/qingkuai-js/qingkuai/compare/v1.0.72...v1.0.73) (2026-06-08)

### Features

- **runtime:** reintroduce effect checks to warn and clean up when effects depend on reactive states ([900e43e](https://github.com/qingkuai-js/qingkuai/commit/900e43e))
- **runtime:** support dynamic components rendered by changing reactive state values ([cd5bfcf](https://github.com/qingkuai-js/qingkuai/commit/cd5bfcf))

### Fixes

- **compiler:** correctly compile reactive identifiers used as component tags into reactive access ([060e483](https://github.com/qingkuai-js/qingkuai/commit/060e483))
- **runtime:** avoid using `bind` when accessing methods on reactive values to preserve prototype behavior ([d3749fa](https://github.com/qingkuai-js/qingkuai/commit/d3749fa))

## [1.0.72](https://github.com/qingkuai-js/qingkuai/compare/v1.0.71...v1.0.72) (2026-06-07)

### Features

- **compiler:** support the `src` attribute on embedded style tags to reference external style files ([a020d44](https://github.com/qingkuai-js/qingkuai/commit/a020d44), [b191d2c](https://github.com/qingkuai-js/qingkuai/commit/b191d2c))
- **compiler:** support the `global` attribute on embedded style tags to prevent style rules from being scoped ([8c9370c](https://github.com/qingkuai-js/qingkuai/commit/8c9370c), [572fdaa](https://github.com/qingkuai-js/qingkuai/commit/572fdaa), [b191d2c](https://github.com/qingkuai-js/qingkuai/commit/b191d2c))

### Refactors

- **runtime:** replace proxy-based component `props`, `refs`, and `slots` with `accessor` properties ([633e751](https://github.com/qingkuai-js/qingkuai/commit/633e751))

### Fixes

- **runtime:** avoid merging a text node with a preceding text anchor node ([019798f](https://github.com/qingkuai-js/qingkuai/commit/019798f))
- **runtime:** remove reactive dependency count checks and proactive stopping from effect callbacks ([327c590](https://github.com/qingkuai-js/qingkuai/commit/327c590))
- **runtime:** return an empty object when component tags receive no props ([ec2a241](https://github.com/qingkuai-js/qingkuai/commit/ec2a241))
- **runtime:** fix component prop value fallback logic so `Getter` values are read before deciding whether to use defaults ([e4272e5](https://github.com/qingkuai-js/qingkuai/commit/e4272e5))

## [1.0.71](https://github.com/qingkuai-js/qingkuai/compare/v1.0.70...v1.0.71) (2026-05-30)

### Fixes

- **compiler:** fix missing source map generation for embedded script blocks ([666c825](https://github.com/qingkuai-js/qingkuai/commit/666c825))

## [1.0.70](https://github.com/qingkuai-js/qingkuai/compare/v1.0.67...v1.0.68) (2026-05-30)

### Improvements

- **compiler(check):** improve diagnostics for reactivity inference results ([de3a425](https://github.com/qingkuai-js/qingkuai/commit/de3a425), [ceb445d](https://github.com/qingkuai-js/qingkuai/commit/ceb445d))

### Refactors

- **compiler(parser):** migrate the script parser from `@babel/parser` to the TypeScript compiler ([470e562](https://github.com/qingkuai-js/qingkuai/commit/470e562))

### Fixes

- **compiler:** fix AST analysis and transform issues, and resolve unit/e2e regressions caused by AST shape differences after parser migration ([d8f1898](https://github.com/qingkuai-js/qingkuai/commit/d8f1898), [fa23809](https://github.com/qingkuai-js/qingkuai/commit/fa23809), [a4777f1](https://github.com/qingkuai-js/qingkuai/commit/a4777f1))

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
