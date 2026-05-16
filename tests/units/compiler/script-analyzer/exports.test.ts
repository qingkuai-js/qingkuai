import type { ExpectedCompileMessage } from "#type-declarations/testing"

import { test, expect } from "vitest"
import { formatSourceCode } from "../../../../src/util/shared/sundry"
import { analyzeScript } from "../../../../src/compiler/analyzer/script"
import { messages, analyzeResult } from "../../../../src/compiler/state"
import { matchCompileMessages } from "../../../../src/util/testing/match"
import { parseTemplateTesting } from "../../../../src/util/testing/sundry"

function localAnalyze(source: string) {
    parseTemplateTesting(`<lang-ts>${formatSourceCode(source)}</lang-ts>`, {
        recover: true
    })
    analyzeScript()
}

function localMatchCompileMessages(expected: ExpectedCompileMessage[]) {
    for (const item of expected) {
        item.range[0] += 9
        item.range[1] += 9
    }
    matchCompileMessages(expected)
}

test("Allows named exports in embedded script", () => {
    localAnalyze(`
        export let count = reactive(0)
        function inc() {
            count++
        }
        export { inc as increase }
    `)
    expect(analyzeResult.script.exportedBindings).toEqual([
        {
            local: "count",
            exported: "count"
        },
        {
            local: "inc",
            exported: "increase"
        }
    ])
    expect(messages.length).toBe(0)
})

test("Rejects unsupported export forms in embedded script", () => {
    localAnalyze(`
        export default 1
        export * from "./foo"
        export { bar } from "./bar"
        export = foo
    `)

    localMatchCompileMessages([
        {
            type: "error",
            range: [0, 16],
            value: "Default export is not supported in embedded script block."
        },
        {
            type: "error",
            range: [17, 38],
            value: "Export-all is not supported in embedded script block."
        },
        {
            type: "error",
            range: [39, 66],
            value: "Re-export declaration is not supported in embedded script block."
        },
        {
            type: "error",
            range: [67, 79],
            value: "TS assignment export is not supported in embedded script block."
        }
    ])
})

test("Rejects and ignores type exports in embedded script", () => {
    localAnalyze(`
        type Foo = string
        export type { Foo }
    `)

    localMatchCompileMessages([
        {
            type: "error",
            range: [18, 37],
            value: "Type export is not supported in embedded script block."
        }
    ])
})

test("Rejects type specifier in mixed named exports", () => {
    localAnalyze(`
        const a = 1
        type b = number
        export { a, type b }
    `)

    localMatchCompileMessages([
        {
            type: "error",
            range: [40, 46],
            value: "Type export is not supported in embedded script block."
        }
    ])
    expect(analyzeResult.script.exportedBindings).toEqual([
        {
            local: "a",
            exported: "a"
        }
    ])
})

test("Rejects type-only declaration exports", () => {
    localAnalyze(`
        export type Foo = string
    `)

    localMatchCompileMessages([
        {
            type: "error",
            range: [0, 24],
            value: "Type export is not supported in embedded script block."
        }
    ])
    expect(analyzeResult.script.exportedBindings).toEqual([])
})

test("Rejects interface exports", () => {
    localAnalyze(`
        export interface Foo { x: number }
    `)

    localMatchCompileMessages([
        {
            type: "error",
            range: [0, 34],
            value: "Type export is not supported in embedded script block."
        }
    ])
    expect(analyzeResult.script.exportedBindings).toEqual([])
})

test("Multiple type specifiers produce multiple errors", () => {
    localAnalyze(`
        export type { A, B, C }
    `)

    const errors = messages.filter(item => item.type === "error")
    expect(errors.length).toBe(3)
    expect(analyzeResult.script.exportedBindings).toEqual([])
})

test("String literal export names", () => {
    localAnalyze(`
        const a = 1
        export { a as "x-y" }
    `)

    expect(messages.length).toBe(0)
    expect(analyzeResult.script.exportedBindings).toEqual([
        {
            local: "a",
            exported: "x-y"
        }
    ])
})

test("Export name collision: last export wins", () => {
    localAnalyze(`
        const a = 1
        const b = 2
        export { a as x, b as x }
    `)

    expect(messages.length).toBe(0)
    expect(analyzeResult.script.exportedBindings).toEqual([
        {
            local: "a",
            exported: "x"
        },
        {
            local: "b",
            exported: "x"
        }
    ])
})

test("Enum exports are supported as values", () => {
    localAnalyze(`
        export enum Foo { A = 1, B = 2 }
    `)

    expect(messages.length).toBe(0)
    expect(analyzeResult.script.exportedBindings).toEqual([
        {
            local: "Foo",
            exported: "Foo"
        }
    ])
})

test("No exports when all are rejected", () => {
    localAnalyze(`
        export type Foo = string
        export interface Bar {}
    `)

    const errors = messages.filter(item => item.type === "error")
    expect(errors.length).toBe(2)
    expect(analyzeResult.script.exportedBindings).toEqual([])
})
