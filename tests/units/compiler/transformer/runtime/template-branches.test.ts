import { test, expect } from "vitest"
import { compile } from "../../../../../src/compiler/compile"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"

function compileRuntime(source: string, debug = false) {
    const result = compile(formatSourceCode(source), { debug })
    expect(result.messages.filter(item => item.type === "error")).toEqual([])
    return result.code
}

function compileRuntimeWithOptions(source: string, options: Parameters<typeof compile>[1]) {
    const result = compile(formatSourceCode(source), options)
    expect(result.messages.filter(item => item.type === "error")).toEqual([])
    return result.code
}

test("Component without context uses plain anchor call", () => {
    const code = compileRuntime(`<Comp></Comp>`)
    expect(code).toContain("Comp(_text1)")
    expect(code).not.toContain("Comp(_text1, {")
})

test("Slot without attrs uses UNDEF props and fallback closure", () => {
    const code = compileRuntime(`
        <Comp>
            <slot>
                <span>fallback</span>
            </slot>
        </Comp>
    `)
    expect(code).toContain('_.renderSlot(_ctx, "default",')
    expect(code).toContain("_.UNDEF, () => {")
})

test("Slot with dynamic and static attrs builds slot props object", () => {
    const code = compileRuntime(`
        <lang-js>
            let label = "A"
        </lang-js>
        <slot name="main" !title={label} fixed></slot>
    `)
    expect(code).toContain('_.renderSlot(_ctx, "main",')
    expect(code).toContain("title: label")
    expect(code).toContain("fixed: true")
})

test("Component refs skip &handle in r block and bind separately", () => {
    const code = compileRuntime(`
        <lang-js>
            let model = ""
            let handle = null
        </lang-js>
        <Comp &value={model} &handle={handle}></Comp>
    `)
    expect(code).toContain("r: {")
    expect(code).toContain("value: [")
    expect(code).toContain("_.bindHandleReceiver")
    expect(code).toContain("Comp(_text1, {")
    expect(code).not.toContain("handle: [")
})

test("Await then catch without inline then keeps NIL placeholder", () => {
    const code = compileRuntime(`
        <lang-js>
            let p = Promise.resolve(1)
        </lang-js>
        <div #await={p}>pending</div>
        <div #catch={e}>error: {e}</div>
    `)
    expect(code).toContain("_.promiseBlock(")
    expect(code).toContain("_.NIL,")
})

test("Then branch without fragment content writes UNDEF", () => {
    const code = compileRuntime(`
        <lang-js>
            let p = Promise.resolve(1)
        </lang-js>
        <qk:spread #await={p}></qk:spread>
        <qk:spread #then={v}></qk:spread>
    `)
    expect(code).toContain("_.UNDEF,")
})

test("List block without key uses listBlock call", () => {
    const code = compileRuntime(`
        <lang-js>
            let items = [1, 2, 3]
        </lang-js>
        <div #for={item of items}>{item}</div>
    `)
    expect(code).toContain("_.listBlock(")
    expect(code).not.toContain("_.keyedListBlock(")
})

test("Expression event uses inline delegate block", () => {
    const code = compileRuntime(`
        <lang-js>
            const fn = 0
        </lang-js>
        <button @keyup={fn + 1}></button>
    `)
    expect(code).toContain('_.delegate(_button1, "keyup", $arg => {')
    expect(code).toContain("fn + 1")
})

test("Function literal event is passed directly", () => {
    const code = compileRuntime(`<button @click={() => 1}></button>`)
    expect(code).toContain('_.delegate(_button1, "click", () => 1)')
})

test("Inline statement handler becomes $arg block", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = 0
        </lang-js>
        <button @click={count++}></button>
    `)
    expect(code).toContain("$arg => {")
    expect(code).toContain("count.$++")
})

test("Invalid slot prop key uses computed context key", () => {
    const code = compileRuntime(`
        <slot long-prop="a"></slot>
    `)
    expect(code).toContain('["long-prop"]: "a"')
})

test("Export-free template returns plain mount call", () => {
    const code = compileRuntime("")
    expect(code).toContain("return _.mount()")
    expect(code).not.toContain("defineExports")
})

test("Debug mode keeps generation parseable for same branches", () => {
    const code = compileRuntime(
        `
        <lang-js>
            let p = Promise.resolve(1)
            let label = "ok"
        </lang-js>
        <Comp title="x" @click={label = label + "!"}></Comp>
        <div #await={p}>pending</div>
        <div #then={v}>{v}</div>
    `,
        true
    )
    expect(code).toContain("_.promiseBlock(")
    expect(code).toContain("Comp(")
    expect(code).toContain("p: {")
    expect(code).not.toContain("r:")
})

test("Component inline event in props becomes $arg wrapper", () => {
    const code = compileRuntime(`
        <lang-js>
            let count = 0
        </lang-js>
        <Comp @click={count++}></Comp>
    `)
    expect(code).toContain("p: {")
    expect(code).toContain("click: __ => ($arg => {")
    expect(code).toContain("count.$++")
})

test("Component slot patterns generate arg list", () => {
    const code = compileRuntime(`
        <Comp>
            <div #slot={ctx from "main"}></div>
        </Comp>
    `)
    expect(code).toContain("s: {")
    expect(code).toContain("main: (")
    expect(code).toContain(", ctx")
})

test("Await with then omits NIL placeholder", () => {
    const code = compileRuntime(`
        <lang-js>
            let p = Promise.resolve(1)
        </lang-js>
        <div #await={p}>pending</div>
        <div #then={v}>ok: {v}</div>
        <div #catch={e}>err: {e}</div>
    `)
    expect(code).toContain("_.promiseBlock(")
    expect(code).not.toContain("_.NIL,")
})

test("Keyed list with text equal to key still generates setText for node text", () => {
    const code = compileRuntime(`
        <lang-js>
            let list = [{ id: 1 }, { id: 2 }]
        </lang-js>
        <div #for={item of list} #key={item.id}>{item.id}</div>
    `)
    expect(code).toContain("_.keyedListBlock(")
    expect(code).toContain("_.setText(")
})

test("Keyed list with extra text keeps setText update", () => {
    const code = compileRuntime(`
        <lang-js>
            let list = [{ id: 1 }, { id: 2 }]
        </lang-js>
        <div #for={item of list} #key={item.id}>id: {item.id}</div>
    `)
    expect(code).toContain("_.keyedListBlock(")
    expect(code).toContain("_.setText(")
})

test("Non-delegatable event uses listen call", () => {
    const code = compileRuntime(`
        <lang-js>
            let y = 0
        </lang-js>
        <div @wheel={y++}></div>
    `)
    expect(code).toContain('_.listen(_div1, "wheel", $arg => {')
    expect(code).toContain("y.$++")
})

test("If-elif-else chain keeps condition block tuple", () => {
    const code = compileRuntime(`
        <lang-js>
            let a = true
            let b = false
        </lang-js>
        <div #if={a}>A</div>
        <div #elif={b}>B</div>
        <div #else>C</div>
    `)
    expect(code).toContain("_.conditionBlock([")
    expect(code).toContain("__ => (a)")
    expect(code).toContain("__ => (b)")
})

test("Await then catch chain keeps promiseBlock branches", () => {
    const code = compileRuntime(`
        <lang-js>
            let p = Promise.resolve(1)
        </lang-js>
        <div #await={p}>P</div>
        <div #then={v}>T {v}</div>
        <div #catch={e}>C {e}</div>
    `)
    expect(code).toContain("_.promiseBlock(")
    expect(code).toContain("__ => (p.$)")
    expect(code).toContain("(v) => {")
    expect(code).toContain("(e) => {")
})

test("Component refs with multiple keys emit entries", () => {
    const code = compileRuntime(`
        <lang-js>
            let a = ""
            let b = false
        </lang-js>
        <Comp &value={a} &checked={b}></Comp>
    `)
    expect(code).toContain("r: {")
    expect(code).toContain("value: [")
    expect(code).toContain("checked: [")
})

test("Component default slot without #slot directive is emitted", () => {
    const code = compileRuntime(`
        <Comp>
            <div>child</div>
        </Comp>
    `)
    expect(code).toContain("s: {")
    expect(code).toContain('["default"]: (')
})

test("Html directive with sibling directive is generated after node selection", () => {
    const code = compileRuntime(`
        <lang-js>
            let ok = true
            let html = "<b>x</b>"
        </lang-js>
        <div #if={ok} #html>{html}</div>
    `)
    expect(code).toContain("_.conditionBlock([")
    expect(code).toContain("_.htmlBlock(")
})

test("Keyed for without explicit pattern uses anchor argument branch", () => {
    const code = compileRuntime(`
        <lang-js>
            let list = [1, 2]
            let key = 0
        </lang-js>
        <div #for={list} #key={key}>{list.length}</div>
    `)
    expect(code).toContain("_.keyedListBlock(")
    expect(code).toContain("(_anchor")
})

test("Class and select dynamic attributes use dedicated setters", () => {
    const code = compileRuntime(`
        <lang-js>
            let cls = "x"
            let selected = "b"
        </lang-js>
        <div class="base" !class={cls}></div>
        <select !value={selected}></select>
    `)
    expect(code).toContain("_.setClassName(")
    expect(code).toContain('["base", ')
    expect(code).toContain("_.setSelectValue(")
})

test("Complex event expression and modifiers cover wrapper and flags", () => {
    const code = compileRuntime(`
        <lang-js>
            let a = () => 1
            let b = () => 2
            let cond = true
        </lang-js>
        <button @click|stop|capture={cond ? a : b}></button>
    `)
    expect(code).toContain('_.delegate(_button1, "click", $arg => {')
    expect(code).toContain(", 18)")
})

test("Native refs generate all bind call variants", () => {
    const code = compileRuntime(`
        <lang-js>
            let n = 0
            let c = false
            let g = []
            let h = null
            let v = ""
            let sv = ""
            let sm = []
        </lang-js>
        <input &number={n} />
        <input type="checkbox" &checked={c} />
        <input type="checkbox" value="a" &group={g} />
        <div &handle={h}></div>
        <input &value={v} />
        <select &value={sv}></select>
        <select multiple &value={sm}></select>
    `)
    expect(code).toContain("_.bindInputNumber(")
    expect(code).toContain("_.bindInputChecked(")
    expect(code).toContain("_.bindInputGroup(")
    expect(code).toContain("_.bindHandleReceiver(")
    expect(code).toContain("_.bindInputValue(")
    expect(code).toContain("_.bindSelectValue(")
})

test("Dotted component name and boolean prop are emitted", () => {
    const code = compileRuntime(`
        <lang-js>
            let UI = { Button: Comp }
        </lang-js>
        <UI.Button disabled></UI.Button>
    `)
    expect(code).toContain("UI.$.Button")
    expect(code).toContain("disabled: true")
    expect(code).toContain("dynamicComponent")
})

test("Reactive identifier component tag uses accessor call", () => {
    const code = compileRuntime(`
        <lang-js>
            let Comp = reactive(Foo)
        </lang-js>
        <Comp></Comp>
    `)
    expect(code).toContain("Comp.$")
    expect(code).toContain("dynamicComponent")
})

test("Reactive base in member component tag keeps accessor on base", () => {
    const code = compileRuntime(`
        <lang-js>
            let UI = reactive({ Comp })
        </lang-js>
        <UI.Comp></UI.Comp>
    `)
    expect(code).toContain("UI.$.Comp")
    expect(code).toContain("dynamicComponent")
})

test("Component events and dynamic props use getter wrappers", () => {
    const code = compileRuntime(`
        <lang-js>
            let title = "x"
            let handler = () => 1
        </lang-js>
        <Comp @click={handler} !title={title}></Comp>
    `)
    expect(code).toContain("click: __ => (")
    expect(code).toContain("handler")
    expect(code).toContain("title: __ => (title")
})

test("Await with same-node then writes UNDEF no-render placeholder", () => {
    const code = compileRuntime(`
        <lang-js>
            let p = Promise.resolve(1)
        </lang-js>
        <div #await={p} #then={v}></div>
    `)
    expect(code).toContain("_.promiseBlock(")
    expect(code).toContain("_.UNDEF,")
})

test("For without explicit pattern and without key uses default getter arg", () => {
    const code = compileRuntime(`
        <lang-js>
            let list = [1, 2, 3]
        </lang-js>
        <div #for={list}>x</div>
    `)
    expect(code).toContain("_.listBlock(")
    expect(code).toContain("__ => {")
})

test("Interpretive comments annotate wrapper and general event flags", () => {
    const code = compileRuntimeWithOptions(
        `
            <lang-js>
                let handler = () => 1
            </lang-js>
            <input @keydown|enter|stop={handler} />
        `,
        { debug: false, interpretiveComments: true }
    )
    expect(code).toContain("_.createEventWrapper(")
    expect(code).toContain("/* enter */")
    expect(code).toContain("/* stop */")
})
