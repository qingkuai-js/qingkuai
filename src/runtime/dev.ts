// 开发期专用代码（警告与诊断信息）的开关。
//
// `__qk__dev` 是编译期常量，由宿主构建提供（例如 vite 的 `define: { __qk__dev: false }`）。
// 生产构建中它会被折叠为字面量，`if (DEV)` 包裹的警告调用连同它们的消息字符串会被
// 打包器整体剔除，因此警告文案不会进入生产产物；开发环境下保持开启。
//
// 常量缺失时按开发模式处理，并用 `typeof` 判断取值：既避免在未提供该常量的环境中
// （例如直接用 importmap 引入 dist 的页面）抛出 ReferenceError，又保留了常量一旦
// 被定义即可被折叠的性质。
//
// The switch for development-only code (warnings and diagnostics).
//
// `__qk__dev` is a compile-time constant provided by the host build, e.g. vite's
// `define: { __qk__dev: false }`. It folds to a literal in production builds, so
// everything guarded by `if (DEV)` — including the message strings — is dropped from
// the bundle, while development builds keep it enabled.
//
// When the constant is missing the runtime assumes development mode. The `typeof`
// check both keeps environments that never define it (a plain importmap page, for
// instance) from throwing and leaves the constant foldable once it is defined.
export const DEV = typeof __qk__dev == "boolean" ? __qk__dev : true
