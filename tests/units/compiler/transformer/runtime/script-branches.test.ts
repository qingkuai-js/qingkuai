import { test, expect } from "vitest"
import { compile } from "../../../../../src/compiler/compile"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"

function compileRuntime(source: string, debug = false) {
    const result = compile(formatSourceCode(source), { debug })
    expect(result.messages.filter(item => item.type === "error")).toEqual([])
    return result.code
}

test("Runtime script: debug const alias/derived in one declaration converts contiguous entries", () => {
    const code = compileRuntime(
        `
        <lang-js>
            let source = { a: 1, b: 2 }
            const a = alias(source.a), b = derivedExp(source.b), c = 3
        </lang-js>
        <div>{a} {b} {c}</div>
    `,
        true
    )
    expect(code).toContain("let a = _.alias(")
    expect(code).toContain(", [_b, b] = _.derived(")
    expect(code).toContain("const c = 3")
})

test("Runtime script: alias shorthand reference rewrites object shorthand", () => {
    const code = compileRuntime(
        `
        <lang-js>
            let source = { a: 1 }
            const a = alias(source.a)
            const obj = { a }
        </lang-js>
        <div>{obj.a}</div>
    `,
        true
    )
    expect(code).toContain("{ a: a[_.REFERENCE_VALUE] }")
})

test("Runtime script: watchExp wraps non-function first argument as getter", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = 1
            watchExp(count + 1, () => {})
        </lang-js>
        <div>{count}</div>
    `)
    expect(code).toContain("_.watchExp(() => (count + 1), () => {})")
})

test("Runtime script: destructuring derivedExp in debug emits setter tuple suffix", () => {
    const code = compileRuntime(
        `
        <lang-js>
            let src = [1, 2]
            const [a, b] = derivedExp(src)
        </lang-js>
        <div>{a} {b}</div>
    `,
        true
    )
    expect(code).toContain("destructuringDerived((")
    expect(code).toContain(", 2, [")
})

test("Runtime script: reactive without argument in debug injects UNDEF setter", () => {
    const code = compileRuntime(
        `
        <lang-js>
            let value = reactive()
        </lang-js>
        <div>{value}</div>
    `,
        true
    )
    expect(code).toContain("_.react(_.UNDEF")
})

test("Runtime script: destructuring reactive without argument uses UNDEF tuple input", () => {
    const code = compileRuntime(
        `
        <lang-js>
            let [a, b] = reactive()
        </lang-js>
        <div>{a} {b}</div>
    `,
        true
    )
    expect(code).toContain("destructuringReact((")
    expect(code).toContain("], _.UNDEF")
})
