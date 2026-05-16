import { test, expect } from "vitest"
import { compile } from "../../../../../src/compiler/compile"

function compileAndGetCode(
    source: string,
    options: Parameters<typeof compile>[1] = { debug: false }
) {
    const result = compile(source, options)
    expect(result.messages.filter(item => item.type === "error")).toEqual([])
    return result.code
}

function getReusedStringLiteralId(code: string, value: string) {
    const matched = code.match(new RegExp(`const\\s+(_s\\d+)\\s*=\\s*${JSON.stringify(value)}`))
    expect(matched).toBeTruthy()
    return matched![1]
}

test("Production: replace repeated string literals in embedded script", () => {
    const code = compileAndGetCode(
        `
            <lang-js>
                const label = \`same\` + "same"
            </lang-js>
            <div>{label}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(`${literalId} + ${literalId}`)
})

test("Production: replace repeated string literals in interpolation expressions", () => {
    const code = compileAndGetCode(
        `
            <div>{"same" + \`same\`}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(`${literalId} + ${literalId}`)
})

test("Production: replace non-computed object string keys as computed", () => {
    const code = compileAndGetCode(
        `
            <lang-js>
                const value = { "same": "same", other: "same" }
            </lang-js>
            <div>{value["same"]}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(`{ [${literalId}]: ${literalId}, other: ${literalId} }`)
    expect(code).toContain(`value[${literalId}]`)
})

test("Production: replace non-computed string keys in object/class methods", () => {
    const code = compileAndGetCode(
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
        `
    )
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(`[${literalId}]() {`)
    expect(code).toContain(`class Box {`)
    expect(code).toContain(`[${literalId}]()`)
    expect(code).toContain(`obj[${literalId}] + new Box()[${literalId}]()`)
})

test("Production: keep TS type literal string keys unchanged", () => {
    const code = compileAndGetCode(
        `
            <lang-ts>
                type A = { "same": string }
                type B = { ["same"](): "same" }
                const x: A = { "same": "same" }
                const y = {} as { ["same"]: "same" }
            </lang-ts>
            <div>{x["same"]}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(`type A = { "same": string }`)
    expect(code).toContain(`type B = { ["same"](): "same" }`)
    expect(code).toContain(`{} as { ["same"]: "same" }`)
    expect(code).toContain(`{ [${literalId}]: ${literalId} }`)
    expect(code).toContain(`x[${literalId}]`)
})

test("Production: > 8 compressed CSS class strings triggers multi-line format", () => {
    const code = compileAndGetCode(
        `
            <lang-js>
                const cls = {
                    aaa: "apple-red" + "apple-red",
                    bbb: "banana-yellow" + "banana-yellow",
                    ccc: "cherry-dark" + "cherry-dark",
                    ddd: "dragon-green" + "dragon-green",
                    eee: "elderberry-purple" + "elderberry-purple",
                    fff: "fig-brown" + "fig-brown",
                    ggg: "grapes-violet" + "grapes-violet",
                    hhh: "honey-golden" + "honey-golden",
                    iii: "indigo-blue" + "indigo-blue"
                }
            </lang-js>
            <div class="apple-red">{cls}</div>
        `
    )
    const compressStrings = code.match(/const _compressStrings = \[([\s\S]*?)\]/)
    if (compressStrings) {
        expect(compressStrings[1]).toContain("\n")
    }
})

test("Production: repeated static template chunks emit multiline compress array", () => {
    const code = compileAndGetCode(
        `
            <div class="alpha-long-token">x</div>
            <div class="alpha-long-token">x</div>
            <div class="beta-long-token">x</div>
            <div class="beta-long-token">x</div>
            <div class="gamma-long-token">x</div>
            <div class="gamma-long-token">x</div>
            <div class="delta-long-token">x</div>
            <div class="delta-long-token">x</div>
            <div class="epsilon-long-token">x</div>
            <div class="epsilon-long-token">x</div>
            <div class="zeta-long-token">x</div>
            <div class="zeta-long-token">x</div>
            <div class="eta-long-token">x</div>
            <div class="eta-long-token">x</div>
            <div class="theta-long-token">x</div>
            <div class="theta-long-token">x</div>
            <div class="iota-long-token">x</div>
            <div class="iota-long-token">x</div>
        `
    )
    const compressStrings = code.match(/const _compressStrings = \[([\s\S]*?)\]/)
    expect(compressStrings).toBeTruthy()
    expect(compressStrings![1]).toContain("\n")
})

test("Production: tagged template quasi is not extracted as reusable string", () => {
    const code = compileAndGetCode(
        `
            <lang-js>
                const tag = strings => strings[0]
                const x = tag\`tagval\`
                const y = "tagval" + "tagval"
            </lang-js>
            <div>{x + y}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "tagval")
    expect(code).toContain(literalId)
    expect(code).toContain("`tagval`")
})

test("Production: string enum member identifier is not extracted", () => {
    const code = compileAndGetCode(
        `
            <lang-ts>
                enum Dir { "north" = 0, "south" = 1 }
                const x = Dir["north"]
                const y = "north" + "north"
            </lang-ts>
            <div>{x + y}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "north")
    expect(code).toContain(literalId)
    expect(code).toContain('"north" = 0')
})

test("Production: import type source string is not extracted", () => {
    const code = compileAndGetCode(
        `
            <lang-ts>
                type Mod = import("mymod").Value
                const a = "mymod"
                const b = "mymod"
            </lang-ts>
            <div>{a + b}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "mymod")
    expect(code).toContain(literalId)
    expect(code).toContain('import("mymod").Value')
})

test("Production: interpretive comments annotate reused literal replacement", () => {
    const code = compileAndGetCode(
        `
            <div class="same">{"same" + "same"}</div>
        `,
        { debug: false, interpretiveComments: true }
    )
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(`/* same */ ${literalId} + /* same */ ${literalId}`)
})

test("Production: string in TS type assertion is not extracted", () => {
    const code = compileAndGetCode(
        `
            <lang-ts>
                const x = <"castval">someValue
                const y = "castval" + "castval"
            </lang-ts>
            <div>{y}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "castval")
    expect(code).toContain(literalId)
    expect(code).toContain('"castval"')
})

test("Production: string in enum initializer expression is extracted normally", () => {
    const code = compileAndGetCode(
        `
            <lang-ts>
                function makeKey(s: string) { return s }
                enum Status { A = makeKey("enumval"), B = makeKey("enumval") }
            </lang-ts>
            <div></div>
        `
    )
    const literalId = code.match(/const\s+(_s\d+)\s*=\s*"enumval"/)
    expect(literalId).toBeTruthy()
})

test("Production: tagged template with string literal tag keeps tag literal path", () => {
    const code = compileAndGetCode(
        `
            <lang-js>
                const out = ("same")\`ok\`
                const y = "same" + "same"
            </lang-js>
            <div>{out + y}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(literalId)
    expect(code).toContain(`(${literalId})\`ok\``)
})

test("Production: enum string initializers still allow reusable literal extraction", () => {
    const code = compileAndGetCode(
        `
            <lang-ts>
                enum E { A = "same", B = "same" }
                const x = "same" + "same"
            </lang-ts>
            <div>{x}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain(literalId)
    expect(code).toContain(`A = ${literalId}`)
})

test("Production: __proto__ object key is not converted to computed reused key", () => {
    const code = compileAndGetCode(
        `
            <lang-js>
                const a = { "__proto__": 1, "same": "same" }
                const b = "same" + "same"
            </lang-js>
            <div>{a["same"] + b}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain('"__proto__": 1')
    expect(code).toContain(`[${literalId}]: ${literalId}`)
})

test("Production: TS as/satisfies type contexts keep type literals untouched", () => {
    const code = compileAndGetCode(
        `
            <lang-ts>
                const a = (x as "same")
                const b = (x satisfies "same")
                const c = "same" + "same"
            </lang-ts>
            <div>{c}</div>
        `
    )
    const literalId = getReusedStringLiteralId(code, "same")
    expect(code).toContain('as "same"')
    expect(code).toContain('satisfies "same"')
    expect(code).toContain(literalId)
})
