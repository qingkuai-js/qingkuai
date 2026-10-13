declare const __qk__max_schedule_depth: number

// 开发期专用代码（警告与诊断信息）的编译期开关，由宿主构建提供，例如 vite 的
// `define: { __qk__dev: false }`。未提供时运行时按开发模式处理。
// Compile-time switch for development-only code (warnings and diagnostics), provided
// by the host build, e.g. vite's `define: { __qk__dev: false }`. When it is absent
// the runtime assumes development mode.
declare const __qk__dev: boolean | undefined
