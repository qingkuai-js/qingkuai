import { test, expect } from "vitest"
import { compile } from "../../../../../src/compiler/compile"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"

function compileRuntime(source: string) {
    const result = compile(formatSourceCode(source))
    expect(result.messages.filter(item => item.type === "error")).toEqual([])
    return result.code
}

test("Standalone non-reactive identifier interpolation does not generate a render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            const msg = "hi"
        </lang-js>
        <p>{msg}</p>
    `)
    expect(code).not.toContain("_.renderEffect")
    expect(code).toContain("_.setText(_text1, msg)")
})

test("Standalone reactive identifier interpolation keeps the render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
        </lang-js>
        <p>{count}</p>
    `)
    expect(code).toContain("_.renderEffect(() => {")
    expect(code).toContain("_.setText(_text1, count.$)")
})

test("Literal-only expression interpolation does not generate a render effect", () => {
    const code = compileRuntime(`
        <p>{1 + 2}</p>
    `)
    expect(code).not.toContain("_.renderEffect")
    expect(code).toContain("_.setText(_text1, 1 + 2)")
})

test("Expression of non-reactive identifiers does not generate a render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            const msg = "hi"
        </lang-js>
        <p>{msg + "!"}</p>
    `)
    expect(code).not.toContain("_.renderEffect")
    expect(code).toContain(`_.setText(_text1, msg + "!")`)
})

test("Property and element access generate a render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            const msg = "hi"
            const list = [1, 2]
        </lang-js>
        <p>{list[0]}</p>
        <p>{msg.length}</p>
    `)
    expect(code).toContain("_.renderEffect(() => {")
    expect(code).toContain("_.setText(_text11, list[0])")
    expect(code).toContain("_.setText(_text2, msg.length)")
})

test("Function call interpolation generates a render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
            function getDouble() {
                return count * 2
            }
        </lang-js>
        <p>{getDouble()}</p>
    `)
    expect(code).toContain("_.renderEffect(() => {")
    expect(code).toContain("_.setText(_text1, getDouble())")
})

test("Dynamic attribute function call generates a render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
            function getTitle() {
                return "t" + count
            }
        </lang-js>
        <div !title={getTitle()}></div>
    `)
    expect(code).toContain("_.renderEffect(() => {")
    expect(code).toContain(`_.setAttribute(_div1, "title", getTitle())`)
})

test("Dynamic attribute with standalone non-reactive identifier does not generate a render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            const title = raw("t")
        </lang-js>
        <div !title={title}></div>
    `)
    expect(code).not.toContain("_.renderEffect")
    expect(code).toContain(`_.setAttribute(_div1, "title", title)`)
})

test("Raw calls keep the interpolation static", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
            let config = load()
            function load() {
                return { label: "l" }
            }
        </lang-js>
        <p>{raw(count)}</p>
        <p>{raw(config)}</p>
    `)
    expect(code).not.toContain("_.renderEffect")
    expect(code).toContain("_.setText(_text2, config)")
    expect(code).toContain("_.setText(_text1, _.toRaw(count))")
})

test("Raw read suffixes make the interpolation reactive while the raw argument is read directly", () => {
    const code = compileRuntime(`
        <lang-js>
            let config = load()
            let list = loadList()
            function load() {
                return { label: "l" }
            }
            function loadList() {
                return ["x"]
            }
        </lang-js>
        <p>{raw(config).label}</p>
        <p>{raw(list)[0]}</p>
    `)
    expect(code).not.toContain("_.toRaw")
    expect(code).toContain("_.renderEffect(() => {")
    expect(code).toContain("_.setText(_text2, list[0])")
    expect(code).toContain("_.setText(_text1, config.label)")
})
