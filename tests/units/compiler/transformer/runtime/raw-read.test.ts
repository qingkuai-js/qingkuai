import { test, expect } from "vitest"
import { compile } from "../../../../../src/compiler/compile"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"

function compileRuntime(source: string) {
    const result = compile(formatSourceCode(source))
    expect(result.messages.filter(item => item.type === "error")).toEqual([])
    return result.code
}

test("Raw call with trailing suffix is optimized to toRaw", () => {
    const code = compileRuntime(`
        <lang-js>
            let config = load()
            function load() {
                return { label: "l" }
            }
        </lang-js>
        <p>{raw(config).label}</p>
    `)
    expect(code).toContain("_.toRaw(config).label")
    expect(code).not.toContain("_.react(")
})

test("Whole-block raw identifier is eliminated to the accessor form outside render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ name: "q" })
        </lang-js>
        <p>{raw(user)}</p>
    `)
    expect(code).toContain("_.setText(_text1, user.$)")
    expect(code).not.toContain("noTracking")
    expect(code).not.toContain("_.renderEffect")
})

test("Whole-block raw with member chain is eliminated outside render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ detail: { label: "l" } })
        </lang-js>
        <p>{raw(user.detail.label)}</p>
    `)
    expect(code).toContain("_.setText(_text1, user.$.detail.label)")
    expect(code).not.toContain("noTracking")
    expect(code).not.toContain("_.renderEffect")
})

test("Whole-block raw with type operations is eliminated with rewrites applied", () => {
    const code = compileRuntime(`
        <lang-ts>
            let user = reactive({ detail: { label: "l" } })
        </lang-ts>
        <p>{raw(user!.detail.label)}</p>
        <p>{raw((user as any).detail.label)}</p>
        <p>{raw(<any>user.detail.label)}</p>
        <p>{raw(user!)}</p>
        <p>{raw(user as any)}</p>
        <p>{raw(<any>user)}</p>
    `)
    expect(code).toContain("_.setText(_text1, user.$!.detail.label)")
    expect(code).toContain("_.setText(_text2, (user.$ as any).detail.label)")
    expect(code).toContain("_.setText(_text3, <any>user.$.detail.label)")
    expect(code).toContain("_.setText(_text4, user.$!)")
    expect(code).toContain("_.setText(_text5, user.$ as any)")
    expect(code).toContain("_.setText(_text6, <any>user.$)")
    expect(code).toContain("_.setText(_text2, (user.$ as any).detail.label)")
    expect(code).toContain("_.setText(_text3, <any>user.$.detail.label)")
})

test("Const reactive base is eliminated to its plain binding", () => {
    const code = compileRuntime(`
        <lang-js>
            const conf = reactive({ detail: { label: "l" } })
        </lang-js>
        <p>{raw(conf.detail.label)}</p>
    `)
    expect(code).toContain("_.setText(_text1, conf.detail.label)")
})

test("Trailing suffixes keep standalone identifier args optimized to toRaw", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ name: "q", detail: { label: "l" } })
            let list = reactive(["x", "y"])
            let index = 0
        </lang-js>
        <p>{raw(user).name}</p>
        <p>{raw(user)?.detail.label}</p>
        <p>{raw(list)[index]}</p>
        <p>{raw(user!.detail).label}</p>
    `)
    expect(code).toContain("_.toRaw(user).name")
    expect(code).toContain("_.toRaw(user)?.detail.label")
    expect(code).toContain("_.toRaw(list)[index]")
    expect(code).toContain("_.noTracking(() => (user.$!.detail)).label")
})

test("Whole-block raw with derived base is eliminated outside render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            const double = derived(() => 1)
        </lang-js>
        <p>{raw(double)}</p>
    `)
    expect(code).toContain("_.setText(_text1, double.$)")
    expect(code).not.toContain("noTracking")
    expect(code).not.toContain("_.renderEffect")
})

test("Mixed expression keeps the effect and optimizes the raw part to toRaw", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ name: "q" })
            let config = load()
            function load() {
                return { label: "l" }
            }
        </lang-js>
        <p>{user.name + raw(config).label}</p>
    `)
    expect(code).toContain("user.$.name + _.toRaw(config).label")
    expect(code).toContain("_.renderEffect")
})

test("Whole-block raw with complex argument is eliminated outside render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
        </lang-js>
        <p>{raw(count + 1)}</p>
    `)
    expect(code).toContain("_.setText(_text1, count.$ + 1)")
    expect(code).not.toContain("noTracking")
    expect(code).not.toContain("_.renderEffect")
})

test("Reference attribute with raw value keeps the binding channel and skips promotion", () => {
    const code = compileRuntime(`
        <lang-js>
            let plain = ""
        </lang-js>
        <input &value={raw(plain)} />
    `)
    expect(code).toContain("_.bindInputValue(_input1, __ => (plain), v => (plain = v))")
    expect(code).not.toContain("_.react(")
})

test("Shared setText with a tracked sibling keeps the raw part in noTracking", () => {
    const code = compileRuntime(`
        <lang-js>
            let a = reactive({ v: 1 })
            let user = reactive({ name: "u" })
        </lang-js>
        <p>{raw(a.v)} - {user.name}</p>
    `)
    // 多插值块复用一个 setText，其位置由追踪的兄弟块决定；
    // raw 部分不能走消除形态（.$ 会在 effect 内重建追踪），保持 noTracking 包裹
    expect(code).toContain("_.noTracking(() => (a.$.v))")
    expect(code).toContain("_.renderEffect(() => {")
    expect(code).toContain("user.$.name")
})

test("Reference attribute on component keeps the accessor getter/setter pair", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ name: "q" })
        </lang-js>
        <Comp &info={raw(user)} />
    `)
    expect(code).toContain("__ => (user.$)")
    expect(code).toContain("v => (user.$ = v)")
})

test("Component prop with standalone identifier argument is optimized to toRaw", () => {
    const code = compileRuntime(`
        <lang-js>
            const conf = reactive({ mode: "dark" })
        </lang-js>
        <Comp !mode={raw(conf).mode} />
    `)
    expect(code).toContain("mode: __ => (_.toRaw(conf).mode)")
})

test("Directive value with raw source is wrapped in noTracking", () => {
    const code = compileRuntime(`
        <lang-js>
            let list = reactive([1, 2])
        </lang-js>
        <li #for={item of raw(list)}>{item}</li>
    `)
    expect(code).toContain("__ => (list.$)")
})

test("Event handler expression with raw value is eliminated to the plain reference", () => {
    const code = compileRuntime(`
        <lang-js>
            let handler = null
        </lang-js>
        <button @click={raw(handler)}></button>
    `)
    expect(code).not.toContain("_.react(")
    expect(code).not.toContain("noTracking")
})

test("Script-side raw read in effect callback is wrapped with noTracking", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
            effect(() => {
                console.log(raw(count))
            })
        </lang-js>
        <p>{count}</p>
    `)
    expect(code).toContain("_.noTracking(() => (count.$))")
})

test("Declaration initializer raw is not wrapped with noTracking", () => {
    const code = compileRuntime(`
        <lang-js>
            let config = raw(load())
            function load() {
                return {}
            }
        </lang-js>
        <p>{config.a}</p>
    `)
    expect(code).toContain("let config = load()")
    expect(code).not.toContain("noTracking")
})
