import type TS from "typescript"

import { createRequire } from "node:module"

// 编译器使用的 typescript API 面，宿主可以注入已有的 typescript 实现，避免再加载一份完整的 typescript
// The TypeScript API surface used by the compiler. Hosts may inject the TypeScript
// implementation they already have instead of loading another full copy of it.
export type TypeScriptApi = typeof TS

let injected: TypeScriptApi | undefined
let entryPath: string | undefined
let cachedRequire: NodeRequire | undefined

// 注入宿主已加载的 typescript 实现，注入后编译器不会再从 `typescript` 包加载
// Inject the TypeScript implementation loaded by the host. Once injected, the compiler
// never loads the `typescript` package itself.
export function setTypeScript(api: TypeScriptApi) {
    injected = api
    entryPath = undefined
}

// 注入宿主提供的 typescript 入口文件路径，实现本身仍在首次使用时才加载
// Inject the path of a TypeScript entry file provided by the host. The implementation
// itself is still only loaded on first use, so callers can forward the path without
// paying for the load up front.
export function setTypeScriptPath(path: string) {
    entryPath = path
    injected = undefined
}

// 获取 typescript API：优先返回注入的实现，未注入时按需从注入的路径或 `typescript` 包加载
// Get the TypeScript API: the injected implementation if present, otherwise it is loaded
// on demand from the injected path or from the `typescript` package.
export function getTypeScript(): TypeScriptApi {
    if (!injected) {
        injected = loadTypeScript()
    }
    return injected
}

// 编译器内部统一以 `ts.xxx` 的形式访问 typescript API，这里用代理隐藏「注入优先、包加载兜底」的差异
// The compiler accesses the TypeScript API uniformly as `ts.xxx`. This proxy hides the
// difference between an injected implementation and the lazily loaded one.
const ts: TypeScriptApi = new Proxy({} as TypeScriptApi, {
    get(_, property) {
        return getTypeScript()[property as keyof TypeScriptApi]
    }
})

export { ts }
export default ts

// 未注入实现时使用，宿主进程（如 tsserver 插件、VS Code 扩展）应通过 setTypeScript 复用已加载的 typescript
// Used when no implementation was injected. Host processes (such as the tsserver plugin
// or the VS Code extension) should reuse their own TypeScript via setTypeScript or
// setTypeScriptPath.
function loadTypeScript(): TypeScriptApi {
    const nodeRequire = getNodeRequire()
    if (!nodeRequire) {
        throw new Error(
            'The qingkuai compiler needs the TypeScript API from the "typescript" package, ' +
                'which is unavailable in this runtime. Install "typescript" or inject the API ' +
                "with setTypeScript (or setTypeScriptPath)."
        )
    }
    if (entryPath) {
        try {
            return nodeRequire(entryPath)
        } catch (cause) {
            throw new Error(
                `The qingkuai compiler failed to load the TypeScript implementation at "${entryPath}". ` +
                    'Install "typescript" or inject the API with setTypeScript (or setTypeScriptPath).',
                { cause }
            )
        }
    }
    try {
        return nodeRequire("typescript")
    } catch (cause) {
        throw new Error(
            'The qingkuai compiler failed to load the "typescript" package. Install "typescript" ' +
                "or inject the API with setTypeScript (or setTypeScriptPath).",
            { cause }
        )
    }
}

// ESM 产物中不存在 `require`，借助 createRequire 保持与 CJS 产物一致的解析行为（从当前包位置向上查找）
// `require` does not exist in the ESM output, so `createRequire` keeps the resolution
// behavior identical to the CJS output (walking up from the location of this package).
function getNodeRequire(): NodeRequire | undefined {
    if (cachedRequire) {
        return cachedRequire
    }
    if (typeof require === "function") {
        return (cachedRequire = require)
    }
    if (typeof process !== "undefined" && process.versions?.node) {
        return (cachedRequire = createRequire(import.meta.url))
    }
    return undefined
}
