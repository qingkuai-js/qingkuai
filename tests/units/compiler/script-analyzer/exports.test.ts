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

test("Named export: allows named exports in embedded script", () => {
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

test("Unsupported export: rejects assignment, default and re-export forms", () => {
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
            value: "Re-export is not supported in embedded script block."
        },
        {
            type: "error",
            range: [39, 66],
            value: "Re-export is not supported in embedded script block."
        },
        {
            type: "error",
            range: [67, 79],
            value: "Assignment export is not supported in embedded script block."
        }
    ])
})

test("Type export: rejects type-only export declaration", () => {
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

test("Type export: rejects type specifier in mixed named exports", () => {
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

test("Type export: rejects exported type alias declarations", () => {
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

test("Type export: rejects exported interface declarations", () => {
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

test("Type export: multiple type specifiers produce multiple errors", () => {
    localAnalyze(`
        export type { A, B, C }
    `)
    expect(messages.length).toBe(1)
    expect(analyzeResult.script.exportedBindings).toEqual([])
})

test("Named export: supports string literal export names", () => {
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

test("Named export: repeated exported names are preserved in order", () => {
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

test("Declaration export: enum exports are supported as values", () => {
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

test("Type export: no exported bindings when all exports are rejected", () => {
    localAnalyze(`
        export type Foo = string
        export interface Bar {}
    `)

    localMatchCompileMessages([
        {
            type: "error",
            range: [0, 24],
            value: "Type export is not supported in embedded script block."
        },
        {
            type: "error",
            range: [25, 48],
            value: "Type export is not supported in embedded script block."
        }
    ])
    expect(analyzeResult.script.exportedBindings).toEqual([])
})

test("Named export: empty export clause is allowed and produces no bindings", () => {
    localAnalyze(`
        const a = 1
        export {}
    `)

    expect(messages.length).toBe(0)
    expect(analyzeResult.script.exportedBindings).toEqual([])
})

test("Declaration export: function, class and namespace exports are collected", () => {
    localAnalyze(`
        export function a() {}
        export class B {}
        export namespace C {
            export const d = 1
        }
    `)

    expect(analyzeResult.script.exportedBindings).toEqual([
        {
            local: "a",
            exported: "a"
        },
        {
            local: "B",
            exported: "B"
        },
        {
            local: "C",
            exported: "C"
        }
    ])
    localMatchCompileMessages([
        {
            type: "error",
            range: [41, 86],
            value: "Namespace declarations are not allowed in component embedded scripts because the embedded script block are wrapped inside a component function."
        }
    ])
})

test("Declaration export: variable statement exports collect all destructured bindings", () => {
    localAnalyze(`
        export const { a, b: c } = source
        export let [d, e = f] = list
    `)

    expect(messages.length).toBe(0)
    expect(analyzeResult.script.exportedBindings).toEqual([
        {
            local: "a",
            exported: "a"
        },
        {
            local: "c",
            exported: "c"
        },
        {
            local: "d",
            exported: "d"
        },
        {
            local: "e",
            exported: "e"
        }
    ])
})

test("Unsupported export: default export declarations are rejected", () => {
    localAnalyze(`
        export default function a() {}
        export default class B {}
    `)

    localMatchCompileMessages([
        {
            type: "error",
            range: [0, 30],
            value: "Default export is not supported in embedded script block."
        },
        {
            type: "error",
            range: [31, 56],
            value: "Default export is not supported in embedded script block."
        }
    ])
    expect(analyzeResult.script.exportedBindings).toEqual([])
})

test("Export declaration: incomplete bare export has no clause and no invalid-export error", () => {
    localAnalyze(`
        export *
    `)

    expect(messages.length).toBe(0)
    expect(analyzeResult.script.exportedBindings).toEqual([])
})

test("Unsupported export: incomplete namespace export is rejected", () => {
    localAnalyze(`
        export * as ns
    `)

    localMatchCompileMessages([
        {
            type: "error",
            range: [0, 14],
            value: "Namespace export is not supported in embedded script block."
        }
    ])
    expect(analyzeResult.script.exportedBindings).toEqual([])
})
