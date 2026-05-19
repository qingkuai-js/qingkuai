import { test, expect } from "vitest"
import { compile } from "../../../../../src/compiler/compile"

test("Runtime: named exports become component handle properties", () => {
    const { code, messages } = compile(
        `
            <lang-js>
                export let count = reactive(0)
                function inc() {
                    count++
                }
                export { inc as increase }
            </lang-js>

            <div>{count}</div>
        `,
        {
            debug: false
        }
    )

    expect(messages.filter(item => item.type === "error")).toEqual([])
    expect(code).not.toContain("export let count")
    expect(code).not.toContain("export { inc as increase }")
    expect(code).toContain("_.defineExports(")
    expect(code).toContain("count:  __ => (count.$),")
    expect(code).toContain("increase:  __ => (inc),")
})

test("Runtime: declaration and aliased exports are transformed", () => {
    const { code, messages } = compile(
        `
            <lang-ts>
                export const plain = 1
                export function inc() {
                    return plain + 1
                }
                export class Tool {}
                const inner = 2
                export { inner as renamed, Tool as ExportedTool }
            </lang-ts>

            <div>{plain}</div>
        `,
        {
            debug: false
        }
    )

    expect(messages.filter(item => item.type === "error")).toEqual([])
    expect(code).not.toContain("export const plain")
    expect(code).not.toContain("export function inc")
    expect(code).not.toContain("export class Tool")
    expect(code).not.toContain("export { inner as renamed, Tool as ExportedTool }")
    expect(code).toContain("_.defineExports(")
    expect(code).toContain("plain:  __ => (plain),")
    expect(code).toContain("inc:  __ => (inc),")
    expect(code).toContain("Tool:  __ => (Tool),")
    expect(code).toContain("renamed:  __ => (inner),")
    expect(code).toContain("ExportedTool:  __ => (Tool),")
})

test("Runtime: string literal export names in handle properties", () => {
    const { code, messages: compileMessages } = compile(
        `
            <lang-ts>
                const pkg = {}
                export { pkg as "x-y" }
            </lang-ts>

            <div></div>
        `,
        {
            debug: false
        }
    )

    expect(compileMessages.filter(item => item.type === "error")).toEqual([])
    expect(code).toContain("_.defineExports(")
    expect(code).toContain('["x-y"]:  __ => (pkg),')
})

test("Runtime: enum exports are transformed", () => {
    const { code, messages: compileMessages } = compile(
        `
            <lang-ts>
                export enum Status { Ready, Loading, Done }
            </lang-ts>

            <div></div>
        `,
        {
            debug: false
        }
    )

    expect(compileMessages.filter(item => item.type === "error")).toEqual([])
    expect(code).toContain("_.defineExports(")
    expect(code).toContain("Status:  __ => (Status),")
})

test("Runtime: colliding export names result in last one in handle", () => {
    const { code, messages: compileMessages } = compile(
        `
            <lang-ts>
                const a = 1
                const b = 2
                export { a as same, b as same }
            </lang-ts>

            <div></div>
        `,
        {
            debug: false
        }
    )

    expect(compileMessages.filter(item => item.type === "error")).toEqual([])
    expect(code).toContain("_.defineExports(")
    expect(code).toContain("same:  __ => (b),")
})
