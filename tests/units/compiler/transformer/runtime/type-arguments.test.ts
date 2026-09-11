import { test, expect } from "vitest"
import { compile } from "../../../../../src/compiler/compile"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"

function compileRuntime(source: string, debug = false) {
    const result = compile(formatSourceCode(source), { debug })
    expect(result.messages.filter(item => item.type === "error")).toEqual([])
    return result.code
}

test("Type arguments on derived calls are preserved after renaming", () => {
    const code = compileRuntime(`
        <lang-ts>
            let obj = { list: [1] }
            const a = derived<string[]>(() => obj.list)
            console.log(a)
        </lang-ts>
        <div></div>
    `)
    expect(code).toContain("const a = _.derived<string[]>(() => obj.list)")
})

test("Type arguments combined with non-null assertion on derivedExp are preserved", () => {
    const code = compileRuntime(`
        <lang-ts>
            let count = 1
            const a = derivedExp!<number[]>(count + 1)
            console.log(a)
        </lang-ts>
        <div>{count}</div>
    `)
    expect(code).toContain("const a = _.derived!<number[]>(() => (count + 1))")
})

test("Type arguments combined with satisfies expression are preserved", () => {
    const code = compileRuntime(`
        <lang-ts>
            let count = 1
            const a = (derivedExp satisfies any)<number[]>(count + 1)
            console.log(a)
        </lang-ts>
        <div>{count}</div>
    `)
    expect(code).toContain("const a = (_.derived satisfies any)<number[]>(() => (count + 1))")
})

test("Type arguments are removed with the call shell for destructuring derivedExp", () => {
    const code = compileRuntime(`
        <lang-ts>
            let src = [1, 2]
            const [a, b] = derivedExp<number[]>(src)
        </lang-ts>
        <div>{a} {b}</div>
    `)
    expect(code).toContain("destructuringDerived(([a, b]) => [a, b], () => (src), 2)")
    expect(code).not.toContain("<number[]>")
})

test("Type arguments are removed with the call shell for destructuring derivedExp in debug mode", () => {
    const code = compileRuntime(
        `
        <lang-ts>
            let src = [1, 2]
            const [a, b] = derivedExp<number[]>(src)
        </lang-ts>
        <div>{a} {b}</div>
    `,
        true
    )
    expect(code).toContain("destructuringDerived((")
    expect(code).toContain(", 2, [")
    expect(code).not.toContain("<number[]>")
})

test("Type arguments on raw calls are removed with the call shell", () => {
    const code = compileRuntime(`
        <lang-ts>
            let obj = { list: [] }
            const a = raw!<string[]>(obj.list)
            console.log(a)
        </lang-ts>
        <div></div>
    `)
    expect(code).toContain("const a = obj.list")
    expect(code).not.toContain("<string[]>")
})

test("Type arguments on argument-less raw calls are removed with the call shell", () => {
    const code = compileRuntime(`
        <lang-ts>
            const a = raw<string[]>()
            console.log(a)
        </lang-ts>
        <div></div>
    `)
    expect(code).toContain("const a = _.UNDEF")
    expect(code).not.toContain("<string[]>")
})

test("Type arguments on watchExp calls survive the getter wrapping and renaming", () => {
    const code = compileRuntime(`
        <lang-ts>
            let count = 1
            watchExp<number[]>(count + 1, () => {})
        </lang-ts>
        <div>{count}</div>
    `)
    expect(code).toContain("watch<number[]>(() => (count + 1), () => {})")
})

test("Type arguments combined with non-null assertion on syncWatchExp are preserved", () => {
    const code = compileRuntime(`
        <lang-ts>
            let count = 1
            syncWatchExp!<number[]>(count + 1, () => {})
        </lang-ts>
        <div>{count}</div>
    `)
    expect(code).toContain("syncWatch!<number[]>(() => (count + 1), () => {})")
})

test("Type arguments on setContextExp calls survive the getter wrapping and renaming", () => {
    const code = compileRuntime(`
        <lang-ts>
            const mode = reactive("dark")
            setContextExp!<string>("theme", mode)
        </lang-ts>
        <div></div>
    `)
    expect(code).toContain('setContextGetter<string>("theme", () => (mode))')
})

test("Type arguments on alias calls are preserved in debug mode", () => {
    const code = compileRuntime(
        `
        <lang-ts>
            let source = { a: 1 }
            const a = alias<string>(source.a)
        </lang-ts>
        <div>{a}</div>
    `,
        true
    )
    expect(code).toContain("_.alias<string>(")
})
