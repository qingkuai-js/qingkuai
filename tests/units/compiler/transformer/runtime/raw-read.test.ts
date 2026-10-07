import { test, expect } from "vitest"
import { compile } from "../../../../../src/compiler/compile"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"

function compileRuntime(source: string) {
    const result = compile(formatSourceCode(source))
    expect(result.messages.filter(item => item.type === "error")).toEqual([])
    return result.code
}

test("Raw call with trailing suffix on a non-reactive identifier is read directly", () => {
    const code = compileRuntime(`
        <lang-js>
            let config = load()
            function load() {
                return { label: "l" }
            }
        </lang-js>
        <p>{raw(config).label}</p>
    `)
    expect(code).not.toContain("_.toRaw")
    expect(code).not.toContain("_.react(")
    expect(code).toContain("_.setText(_text1, config.label)")
})

test("Whole-block raw identifier is unwrapped to the raw value outside render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ name: "q" })
        </lang-js>
        <p>{raw(user)}</p>
    `)
    expect(code).not.toContain("_.renderEffect")
    expect(code).not.toContain("noTrackingToRaw")
    expect(code).toContain("_.setText(_text1, _.toRaw(user))")
})

test("Whole-block raw with member chain is unwrapped outside render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ detail: { label: "l" } })
        </lang-js>
        <p>{raw(user.detail.label)}</p>
    `)
    expect(code).not.toContain("_.renderEffect")
    expect(code).not.toContain("noTrackingToRaw")
    expect(code).toContain("_.setText(_text1, _.toRaw(user.$.detail.label))")
})

test("Whole-block raw with type operations is unwrapped with rewrites applied", () => {
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
    expect(code).toContain("_.setText(_text1, _.toRaw(user.$!.detail.label))")
    expect(code).toContain("_.setText(_text2, _.toRaw((user.$ as any).detail.label))")
    expect(code).toContain("_.setText(_text3, _.toRaw(<any>user.$.detail.label))")
    expect(code).toContain("_.setText(_text4, _.toRaw(user!))")
    expect(code).toContain("_.setText(_text5, _.toRaw(user as any))")
    expect(code).toContain("_.setText(_text6, _.toRaw(<any>user))")
})

test("Const reactive base is unwrapped to its plain binding", () => {
    const code = compileRuntime(`
        <lang-js>
            const conf = reactive({ detail: { label: "l" } })
        </lang-js>
        <p>{raw(conf.detail.label)}</p>
    `)
    expect(code).toContain("_.setText(_text1, _.toRaw(conf.detail.label))")
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
    expect(code).toContain("_.toRaw(list)[index]")
    expect(code).toContain("_.toRaw(user)?.detail.label")
    expect(code).toContain("_.noTrackingToRaw(() => (user.$!.detail)).label")
})

test("Whole-block raw with derived base is unwrapped outside render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            const double = derived(() => 1)
        </lang-js>
        <p>{raw(double)}</p>
    `)
    expect(code).not.toContain("noTracking")
    expect(code).not.toContain("_.renderEffect")
    expect(code).toContain("_.setText(_text1, _.toRaw(double.$))")
})

test("Mixed expression keeps the effect and reads the non-reactive raw part directly", () => {
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
    expect(code).toContain("_.renderEffect")
    expect(code).toContain("user.$.name + config.label")
})

test("Whole-block raw with complex argument is unwrapped outside render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
        </lang-js>
        <p>{raw(count + 1)}</p>
    `)
    expect(code).not.toContain("noTracking")
    expect(code).not.toContain("_.renderEffect")
    expect(code).toContain("_.setText(_text1, _.toRaw(count.$ + 1))")
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
    expect(code).toContain("user.$.name")
    expect(code).toContain("_.renderEffect(() => {")
    expect(code).toContain("_.noTrackingToRaw(() => (a.$.v))")
})

test("Reference attribute on component keeps the accessor getter/setter pair", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ name: "q" })
        </lang-js>
        <Comp &info={raw(user)} />
    `)
    expect(code).toContain("v => (user.$ = v)")
    expect(code).toContain("__ => (_.toRaw(user))")
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

test("Directive value with raw source is unwrapped with toRaw", () => {
    const code = compileRuntime(`
        <lang-js>
            let list = reactive([1, 2])
        </lang-js>
        <li #for={item of raw(list)}>{item}</li>
    `)
    expect(code).not.toContain("_.renderEffect")
    expect(code).toContain("__ => (_.toRaw(list))")
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

test("Script-side raw read with a standalone identifier keeps the bare identifier", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
            effect(() => {
                console.log(raw(count))
            })
        </lang-js>
        <p>{count}</p>
    `)
    expect(code).not.toContain("count.$))")
    expect(code).toContain("console.log(_.toRaw(count))")
})

test("Script-side raw read with a non-identifier argument is wrapped with noTrackingToRaw", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ name: "q" })
            function f() {
                return raw(user.name)
            }
        </lang-js>
        <p>{f()}</p>
    `)
    expect(code).toContain("return _.noTrackingToRaw(() => (user.$.name))")
})

test("Top-level script raw read of a raw-value identifier is read directly", () => {
    const code = compileRuntime(`
        <lang-js>
            let conf = 1
            let s = raw(conf)
        </lang-js>
        <p>{s}</p>
    `)
    expect(code).toContain("let s = conf")
    expect(code).not.toContain("noTracking")
})

test("Declaration initializer raw only marks the identifier and keeps the value as-is", () => {
    const code = compileRuntime(`
        <lang-js>
            let config = raw(load())
            function load() {
                return {}
            }
        </lang-js>
        <p>{config.a}</p>
    `)
    expect(code).not.toContain("_.toRaw")
    expect(code).not.toContain("noTracking")
    expect(code).toContain("let config = load()")
})

test("Interpolation of raw marked identifier does not generate a render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            const a = raw(1)
        </lang-js>
        <p>{a}</p>
    `)
    expect(code).toContain("_.setText(_text1, a)")
    expect(code).not.toContain("_.renderEffect")
})

test("Interpolation of degenerated const literal does not generate a render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            const msg = "hi"
        </lang-js>
        <p>{msg}</p>
    `)
    expect(code).toContain("_.setText(_text1, msg)")
    expect(code).not.toContain("_.renderEffect")
})

test("Interpolation of raw object accessor generates a render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
            const obj = raw({
                get double() {
                    return count * 2
                }
            })
        </lang-js>
        <p>{obj.double}</p>
    `)
    expect(code).toContain("_.renderEffect(() => {")
    expect(code).toContain("_.setText(_text1, obj.double)")
})

test("Dynamic attribute with raw value does not generate a render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            const title = raw("t")
        </lang-js>
        <div !title={title}></div>
    `)
    expect(code).toContain(`_.setAttribute(_div1, "title", title)`)
    expect(code).not.toContain("_.renderEffect")
})

test("Top-level script raw read of a derived identifier pauses tracking", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
            const double = derived(() => count * 2)
            console.log(raw(double))
        </lang-js>
    `)
    expect(code).toContain("console.log(_.noTrackingToRaw(() => (double.$)))")
})

test("Top-level script raw read of an alias identifier reads the alias target", () => {
    const code = compileRuntime(`
        <lang-js>
            const userName = alias(props.user.name)
            console.log(raw(userName))
        </lang-js>
    `)
    expect(code).toContain("console.log(_.noTrackingToRaw(() => (props.user.name)))")
})

test("Top-level script raw read with a member expression pauses tracking", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ name: "q" })
            console.log(raw(user.name))
        </lang-js>
    `)
    expect(code).toContain("console.log(_.noTrackingToRaw(() => (user.$.name)))")
})

test("Raw read of a raw-value identifier inside a function is read directly", () => {
    const code = compileRuntime(`
        <lang-js>
            let conf = 1
            function f() {
                return raw(conf)
            }
        </lang-js>
    `)
    expect(code).toContain("return conf")
    expect(code).not.toContain("noTracking")
    expect(code).not.toContain("_.toRaw(conf)")
})

test("Raw read of an unregistered identifier in a mixed expression uses toRaw", () => {
    const code = compileRuntime(`
        <lang-js>
            let step = 1
        </lang-js>
        <p>{raw(window) + step}</p>
    `)
    expect(code).toContain("_.toRaw(window) + step")
    expect(code).not.toContain("noTracking")
})

test("Raw read of a directive context identifier is unwrapped with toRaw", () => {
    const code = compileRuntime(`
        <lang-js>
            let list = reactive([{ v: 1 }])
        </lang-js>
        <li #for={item of list}>{raw(item)}</li>
    `)
    expect(code).toContain("_.toRaw(_ctx1.m)")
})

test("Raw read of a hoisted reactive var keeps the plain var binding", () => {
    const code = compileRuntime(`
        <lang-js>
            var count = reactive(0)
        </lang-js>
        <p>{raw(count)}</p>
    `)
    expect(code).toContain("_.toRaw(count)")
    expect(code).not.toContain("_.toRaw(_count")
})

test("Raw read of a function parameter shadowing a reactive identifier keeps the parameter bare", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
        </lang-js>
        <p>{[1, 2].map(count => raw(count)).join("-")}</p>
    `)
    expect(code).not.toContain("count.$")
    expect(code).toContain("_.toRaw(count)")
})

test("Template reference shadowed by a function parameter is not rewritten", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
        </lang-js>
        <p>{[1, 2].map(count => count + 1).join("-")}</p>
    `)
    expect(code).not.toContain("count.$")
    expect(code).toContain("map(count => count + 1)")
})

test("Script raw read of a parameter shadowing a reactive identifier is unwrapped with toRaw", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
            function f(count) {
                return raw(count)
            }
        </lang-js>
    `)
    expect(code).not.toContain("count.$")
    expect(code).toContain("return _.toRaw(count)")
})

test("Script raw read of a parameter shadowing a derived identifier is unwrapped with toRaw", () => {
    const code = compileRuntime(`
        <lang-js>
            let base = reactive(2)
            const dbl = derived(() => base * 2)
            function f(dbl) {
                return raw(dbl + 1)
            }
        </lang-js>
    `)
    expect(code).not.toContain("dbl.$")
    expect(code).toContain("return _.noTrackingToRaw(() => (dbl + 1))")
})

test("Raw read of a directive context identifier shadowing a raw-value identifier is unwrapped", () => {
    const code = compileRuntime(`
        <lang-js>
            let item = 1
        </lang-js>
        <ul><li #for={item of [1, 2]}>{raw(item)}</li></ul>
    `)
    expect(code).toContain("_.toRaw(_ctx1.m)")
})

test("Raw call on a shallow identifier is optimized to toRaw", () => {
    const code = compileRuntime(`
        <lang-js>
            let s = shallow(0)
        </lang-js>
        <p>{raw(s)}</p>
    `)
    expect(code).toContain("_.toRaw(s)")
})

test("Raw call on an alias identifier is unwrapped to the alias target outside render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            const userName = alias(props.user.name)
        </lang-js>
        <p>{raw(userName)}</p>
    `)
    expect(code).not.toContain("noTracking")
    expect(code).toContain("_.toRaw(props.user.name)")
})

test("Raw call on a derived identifier in a mixed expression is unwrapped outside render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = reactive(0)
            const double = derived(() => count * 2)
        </lang-js>
        <p>{raw(double) + 1}</p>
    `)
    expect(code).not.toContain("_.renderEffect")
    expect(code).not.toContain("noTrackingToRaw")
    expect(code).toContain("_.toRaw(double.$) + 1")
})

test("Native element runtime raw on a dynamic attribute is unwrapped outside render effect", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ detail: { name: "q" } })
        </lang-js>
        <div !name={raw(user.detail)}></div>
    `)
    expect(code).not.toContain("_.renderEffect")
    expect(code).not.toContain("noTrackingToRaw")
    expect(code).toContain("_.toRaw(user.$.detail)")
})

test("Component prop runtime raw keeps the no-tracking wrapper", () => {
    const code = compileRuntime(`
        <lang-js>
            let user = reactive({ detail: { name: "q" } })
        </lang-js>
        <Comp !name={raw(user.detail)} />
    `)
    expect(code).toContain("_.noTrackingToRaw(() => (user.$.detail))")
})
