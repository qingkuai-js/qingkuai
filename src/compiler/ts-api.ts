import type { TypeScriptApi } from "#type-declarations/compiler"

import nodeModule from "node:module"

let entryPath: string | undefined
let injected: TypeScriptApi | undefined
let cachedRequire: NodeJS.Require | undefined

export function getTypeScript(): TypeScriptApi {
    if (!injected) {
        injected = loadTypeScript()
    }
    return injected
}

export function setTypeScriptPath(path: string) {
    entryPath = path
    injected = undefined
}

export function setTypeScript(api: TypeScriptApi) {
    injected = api
    entryPath = undefined
}

export default /*#__PURE__*/ new Proxy({} as TypeScriptApi, {
    get(_, property: keyof TypeScriptApi) {
        return getTypeScript()[property]
    }
})

function loadTypeScript(): TypeScriptApi {
    if (!cachedRequire) {
        if (typeof require === "function") {
            cachedRequire = require
        } else if (typeof process !== "undefined" && process.versions?.node) {
            cachedRequire = nodeModule.createRequire(import.meta.url)
        }
    }
    if (!cachedRequire) {
        throw new Error(
            `The qingkuai compiler needs the TypeScript API, but this runtime cannot load modules. Inject an implementation with "setTypeScript" before using the compiler.`
        )
    }
    if (entryPath) {
        try {
            return cachedRequire(entryPath)
        } catch (cause) {
            throw new Error(
                `The qingkuai compiler failed to load the TypeScript implementation at "${entryPath}". Check the entry path, or inject the API with "setTypeScript".`,
                { cause }
            )
        }
    }
    try {
        return cachedRequire("typescript")
    } catch (cause) {
        throw new Error(
            `The qingkuai compiler failed to load the "typescript" package. Install "typescript", inject the API with "setTypeScript", or provide an entry file path with "setTypeScriptPath".`,
            { cause }
        )
    }
}
