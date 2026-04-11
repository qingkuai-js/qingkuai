import { test, expect } from "vitest"
import { compile } from "../../../../src/compiler/compile"

function getReusedStringLiteralId(code: string, value: string) {
    const matched = code.match(new RegExp(`const\\s+(_s\\d+)\\s*=\\s*${JSON.stringify(value)}`))
    expect(matched).toBeTruthy()
    return matched![1]
}

test("Production: replace repeated string literals in embedded script", () => {
    const { code, messages } = compile(
        `
            <lang-js>
                const label = \`same\` + "same"
            </lang-js>
            <div>{label}</div>
        `,
        { debug: false }
    )

    expect(messages.filter(item => item.type === "error")).toEqual([])
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(`${literalId} + ${literalId}`)
})

test("Production: replace repeated string literals in interpolation expressions", () => {
    const { code, messages } = compile(
        `
            <div>{"same" + \`same\`}</div>
        `,
        { debug: false }
    )

    expect(messages.filter(item => item.type === "error")).toEqual([])
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(`${literalId} + ${literalId}`)
})

test("Production: replace non-computed object string keys as computed", () => {
    const { code, messages } = compile(
        `
            <lang-js>
                const value = { "same": "same", other: "same" }
            </lang-js>
            <div>{value["same"]}</div>
        `,
        { debug: false }
    )

    expect(messages.filter(item => item.type === "error")).toEqual([])
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(`{ [${literalId}]: ${literalId}, other: ${literalId} }`)
    expect(code).toContain(`value[${literalId}]`)
})

test("Production: replace non-computed string keys in object/class methods", () => {
    const { code, messages } = compile(
        `
            <lang-js>
                const obj = {
                    "same"() {
                        return "same"
                    }
                }
                class Box {
                    "same"() {
                        return "same"
                    }
                }
            </lang-js>
            <div>{obj["same"] + new Box()["same"]()}</div>
        `,
        { debug: false }
    )

    expect(messages.filter(item => item.type === "error")).toEqual([])
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(`[${literalId}]() {`)
    expect(code).toContain(`class Box {`)
    expect(code).toContain(`[${literalId}]()`)
    expect(code).toContain(`obj[${literalId}] + new Box()[${literalId}]()`)
})

test("Production: keep TS type literal string keys unchanged", () => {
    const { code, messages } = compile(
        `
            <lang-ts>
                type A = { "same": string }
                type B = { ["same"](): "same" }
                const x: A = { "same": "same" }
                const y = {} as { ["same"]: "same" }
            </lang-ts>
            <div>{x["same"]}</div>
        `,
        { debug: false }
    )

    expect(messages.filter(item => item.type === "error")).toEqual([])
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(`type A = { "same": string }`)
    expect(code).toContain(`type B = { ["same"](): "same" }`)
    expect(code).toContain(`{} as { ["same"]: "same" }`)
    expect(code).toContain(`{ [${literalId}]: ${literalId} }`)
    expect(code).toContain(`x[${literalId}]`)
})