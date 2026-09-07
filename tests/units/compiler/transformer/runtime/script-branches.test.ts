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
    expect(code).toContain("watch(() => (count + 1), () => {})")
})

test("Runtime script: watchExp with type assertion still rewrites to base watch", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = 1
            const w = (watchExp as any)(count + 1, () => {})
        </lang-js>
        <div>{count}</div>
    `)
    expect(code).toContain("(watch as any)(() => (count + 1), () => {})")
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

test("Runtime script: setContext stores as-is, setContextExp wraps as getter", () => {
    const code = compileRuntime(
        `
        <lang-js>
            const base = reactive({ name: "dark" })
            const mode = reactive(base.name)
            const handler = () => 1
            setContext("theme", mode)
            setContext("version", 1)
            setContext("handler", handler)
            setContextExp("themeExp", mode)
            console.log(contexts.theme)
        </lang-js>
        <div>{contexts.theme}</div>
    `
    )
    expect(code).toContain("const setContext = (...args) => _.setContext(instance, ...args)")
    expect(code).toContain(
        "const setContextGetter = (...args) => _.setContextGetter(instance, ...args)"
    )
    expect(code).not.toContain(
        "const setContextExp = (key, exp) => _.setContextExp(instance, key, exp)"
    )
    expect(code).toContain("const contexts = _.initContexts(_meta)")
    expect(code).toContain('setContext("theme", mode)')
    expect(code).toContain('setContext("version", 1)')
    expect(code).toContain('setContext("handler", handler)')
    expect(code).toContain('setContextGetter("themeExp", () => (mode))')
})

test("Runtime script: setContext without template usage still captures instance", () => {
    const code = compileRuntime(
        `
        <lang-js>
            setContext("theme", 1)
        </lang-js>
        <div></div>
    `
    )
    expect(code).toContain("const instance = _.init(")
    expect(code).toContain("const setContext = (...args) => _.setContext(instance, ...args)")

    expect(code).not.toContain("_.initContexts(")
    expect(code).not.toContain(
        "const setContextExp = (key, exp) => _.setContextExp(instance, key, exp)"
    )
})

test("Runtime script: setContextExp without setContext still injects setContextGetter closure", () => {
    const code = compileRuntime(
        `
        <lang-js>
            const mode = reactive("dark")
            setContextExp("theme", mode)
        </lang-js>
        <div></div>
    `
    )
    expect(code).toContain("const instance = _.init(")
    expect(code).toContain(
        "const setContextGetter = (...args) => _.setContextGetter(instance, ...args)"
    )
    expect(code).not.toContain(
        "const setContextExp = (key, exp) => _.setContextExp(instance, key, exp)"
    )
    expect(code).not.toContain("const setContext = (...args) => _.setContext(instance, ...args)")
    expect(code).toContain('setContextGetter("theme", () => (mode))')
})

test("Runtime script: setContextGetter injects dedicated closure", () => {
    const code = compileRuntime(
        `
        <lang-js>
            const mode = reactive("dark")
            setContextGetter("theme", () => mode)
        </lang-js>
        <div></div>
    `
    )
    expect(code).toContain("const instance = _.init(")
    expect(code).toContain(
        "const setContextGetter = (...args) => _.setContextGetter(instance, ...args)"
    )
    expect(code).not.toContain("const setContext = (...args) => _.setContext(instance, ...args)")
})
