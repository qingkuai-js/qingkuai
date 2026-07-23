import { test, expect } from "vitest"
import { compile } from "../../../../../src/compiler/compile"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"

function compileWithReplace(source: string) {
    const result = compile(formatSourceCode(source), {
        replaceQkImport: true
    })
    expect(
        result.messages.filter(item => {
            return item.type === "error"
        })
    ).toEqual([])
    return result.code
}

function compileDefault(source: string) {
    const result = compile(formatSourceCode(source))
    expect(
        result.messages.filter(item => {
            return item.type === "error"
        })
    ).toEqual([])
    return result.code
}

test("replaceQkImport: replaces .qk paths with .js in import declarations", () => {
    const code = compileWithReplace(`
        <lang-js>
            import Child from "./child.qk"
        </lang-js>
        <div></div>
    `)
    expect(code).toContain(`"./child.js"`)
    expect(code).not.toContain(`"./child.qk"`)
})

test("replaceQkImport: replaces .qk paths and preserves query parameters", () => {
    const code = compileWithReplace(`
        <lang-js>
            import rawContent from "./foo.qk?inline"
        </lang-js>
        <div></div>
    `)
    expect(code).toContain(`"./foo.js?inline"`)
    expect(code).not.toContain(`"./foo.qk?inline"`)
})

test("replaceQkImport: keeps non-.qk paths unchanged", () => {
    const code = compileWithReplace(`
        <lang-js>
            import util from "./foo.js"
        </lang-js>
        <div></div>
    `)
    expect(code).toContain(`"./foo.js"`)
})

test("replaceQkImport: replaces .qk paths in import = require syntax", () => {
    const code = compileWithReplace(`
        <lang-ts>
            import child = require("./bar.qk")
        </lang-ts>
        <div></div>
    `)
    expect(code).toContain(`"./bar.js"`)
    expect(code).not.toContain(`"./bar.qk"`)
})

test("replaceQkImport: does not replace when option is disabled", () => {
    const code = compileDefault(`
        <lang-js>
            import Child from "./child.qk"
        </lang-js>
        <div></div>
    `)
    expect(code).toContain(`"./child.qk"`)
    expect(code).not.toContain(`"./child.js"`)
})

test("replaceQkImport: only replaces .qk paths among mixed imports", () => {
    const code = compileWithReplace(`
        <lang-js>
            import Child from "./child.qk"
            import util from "./util.js"
            import type from "./types.d.ts"
        </lang-js>
        <div></div>
    `)
    expect(code).toContain(`"./child.js"`)
    expect(code).not.toContain(`"./child.qk"`)
    expect(code).toContain(`"./util.js"`)
    expect(code).toContain(`"./types.d.ts"`)
})

test("replaceQkImport: handles template without script block gracefully", () => {
    const code = compileWithReplace(`
        <div>hello</div>
    `)
    expect(code).toBeDefined()
    expect(code).not.toContain(".qk")
})
