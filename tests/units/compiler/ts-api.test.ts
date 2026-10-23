import type { ExecFileException } from "node:child_process"

import nodeFs from "node:fs"
import nodeOs from "node:os"
import nodeUrl from "node:url"
import nodePath from "node:path"
import nodeChildProcess from "node:child_process"

import { afterEach, expect, test, vi } from "vitest"

const TYPESCRIPT_ENTRY = nodePath.resolve("node_modules/typescript/lib/typescript.js")
const MISSING_ENTRY = nodePath.resolve("node_modules/typescript/lib/definitely-missing.js")
const SOURCE_ENTRY = nodePath.resolve("src/compiler/ts-api.ts")
const SOURCE_URL = nodeUrl.pathToFileURL(SOURCE_ENTRY).href
const TSX_BIN = nodePath.resolve("node_modules/.bin/tsx")

// 注入状态保存在模块顶层，每个用例重新加载模块以保证互不影响
// Injection state lives at module top level; each case reloads the module to stay independent.
async function importTsApi() {
    vi.resetModules()
    return await import("../../../src/compiler/ts-api")
}

// vitest 会在模块作用域注入 require，无 require 的宿主场景只能在独立子进程中模拟
// vitest injects a module-scoped require, so require-free host scenarios must run in child processes.
function runHostScript(scriptName: string, script: string, extraFiles?: [string, string][]) {
    const tempDir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "qk-tsapi-"))
    try {
        for (const [name, content] of extraFiles ?? []) {
            nodeFs.writeFileSync(nodePath.join(tempDir, name), content)
        }

        const scriptPath = nodePath.join(tempDir, scriptName)
        nodeFs.writeFileSync(scriptPath, script)
        return nodeChildProcess.execFileSync(TSX_BIN, [scriptPath], {
            encoding: "utf8",
            timeout: 30000
        })
    } catch (error) {
        const failure = error as ExecFileException
        throw new Error(`host script ${scriptName} failed:\n${failure.stderr || failure.message}`)
    } finally {
        nodeFs.rmSync(tempDir, { recursive: true, force: true })
    }
}

afterEach(() => {
    vi.resetModules()
})

test("Function: getTypeScript loads the installed typescript package by default", async () => {
    const { getTypeScript } = await importTsApi()
    expect(typeof getTypeScript().createSourceFile).toBe("function")
})

test("Function: setTypeScript returns the injected implementation", async () => {
    const FAKE_API = { createSourceFile: null } as any
    const { getTypeScript, setTypeScript } = await importTsApi()
    setTypeScript(FAKE_API)
    expect(getTypeScript()).toBe(FAKE_API)
})

test("Function: setTypeScriptPath reloads the api from the entry file and resets the injection", async () => {
    const FAKE_API = { createSourceFile: null } as any
    const { getTypeScript, setTypeScript, setTypeScriptPath } = await importTsApi()
    setTypeScript(FAKE_API)
    setTypeScriptPath(TYPESCRIPT_ENTRY)

    const api = getTypeScript()
    expect(api).not.toBe(FAKE_API)
    expect(typeof api.createSourceFile).toBe("function")
})

test("Function: setTypeScript clears a previously set entry path", async () => {
    const FAKE_API = { createSourceFile: null } as any
    const { getTypeScript, setTypeScript, setTypeScriptPath } = await importTsApi()
    setTypeScriptPath(MISSING_ENTRY)
    setTypeScript(FAKE_API)

    // 坏掉的入口路径已被清除，不应触发加载失败
    // The broken entry path has been cleared, so no load failure should happen.
    expect(getTypeScript()).toBe(FAKE_API)
})

test("Function: setTypeScriptPath wraps load failures of the entry file", async () => {
    const { getTypeScript, setTypeScriptPath } = await importTsApi()
    setTypeScriptPath(MISSING_ENTRY)

    let cause: unknown = null
    try {
        getTypeScript()
        expect.unreachable()
    } catch (error) {
        cause = (error as Error).cause
        expect((error as Error).message).toContain("failed to load the TypeScript implementation")
    }
    expect(cause).toBeTruthy()
})

test("default export proxies property access to the active implementation", async () => {
    const FAKE_API = { version: "0.0.0-fake", createSourceFile: null } as any
    const tsApi = await importTsApi()
    tsApi.setTypeScript(FAKE_API)
    expect(tsApi.default.version).toBe("0.0.0-fake")
})

test("Function: getTypeScript throws in module-free runtimes and recovers via createRequire", () => {
    const script = `
        const api = await import(${JSON.stringify(SOURCE_URL)})
        const realProcess = process
        globalThis.process = { versions: {} }
        try {
            api.getTypeScript()
            throw new Error("expected getTypeScript to throw when no module loader exists")
        } catch (error) {
            if (!/cannot load modules/.test(String(error))) {
                throw error
            }
        }
        globalThis.process = realProcess
        if (typeof api.getTypeScript().createSourceFile !== "function") {
            throw new Error("expected the createRequire fallback to load typescript")
        }
        console.log("MODULE_FREE_HOST_OK")
    `
    expect(runHostScript("module-free-host.mts", script)).toContain("MODULE_FREE_HOST_OK")
})

test("Function: getTypeScript wraps a missing typescript package in ESM hosts", () => {
    const script = `
        const api = await import("./ts-api.mts")
        try {
            api.getTypeScript()
            throw new Error("expected getTypeScript to throw when typescript is not installed")
        } catch (error) {
            if (!/failed to load the "typescript" package/.test(String(error))) {
                throw error
            }
            if (!(error && error.cause)) {
                throw new Error("expected the load failure to be attached as cause")
            }
        }
        console.log("MISSING_PACKAGE_OK")
    `
    const source = nodeFs.readFileSync(SOURCE_ENTRY, "utf8")
    expect(runHostScript("missing-package-host.mts", script, [["ts-api.mts", source]])).toContain(
        "MISSING_PACKAGE_OK"
    )
})
