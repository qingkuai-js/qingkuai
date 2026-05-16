import { test, expect } from "vitest"

import { LSC } from "../../../../../src/compiler/constants"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"
import { compileIntermediate } from "../../../../../src/compiler/compile"

function compileIntermediateResult(source: string) {
    return compileIntermediate(formatSourceCode(source))
}

test("Intermediate codegen: component dynamic attribute with non-curly value is stringified", () => {
    const result = compileIntermediateResult(`<Comp !foo="bar"></Comp>`)
    expect(result.code).toContain('foo: "\\"bar\\""')
})

test("Intermediate codegen: component event with non-curly value is stringified", () => {
    const result = compileIntermediateResult(`<Comp @click="handler"></Comp>`)
    expect(result.code).toContain('click: "\\"handler\\""')
})

test("Intermediate codegen: non-component shorthand event uses validateEventHandler", () => {
    const result = compileIntermediateResult(`
        <lang-js>
            let tap = () => {}
        </lang-js>
        <button @tap></button>
    `)

    expect(result.code).toContain(`${LSC.UTIL}.validateEventHandler("tap", tap);`)
})

test("Intermediate codegen: slot shorthand event does not call validateEventHandler", () => {
    const result = compileIntermediateResult(`<slot @tap></slot>`)

    expect(result.code).toContain("tap;")
    expect(result.code).not.toContain(`${LSC.UTIL}.validateEventHandler("tap"`)
})

test("Intermediate codegen: slot dynamic attribute writes getTypeDelayMarking call", () => {
    const result = compileIntermediateResult(`
        <lang-js>
            let v = 1
        </lang-js>
        <slot name="main" !label={v}></slot>
    `)

    expect(result.code).toContain(`${LSC.GET_TYPE_DELAY_MARKING}("main", "label", v);`)
})

test("Intermediate codegen: slot static name attribute is skipped in type-delay marking", () => {
    const result = compileIntermediateResult(`
        <slot name="main" title="hello"></slot>
    `)

    expect(result.code).toContain(`${LSC.GET_TYPE_DELAY_MARKING}("main", "title", "hello");`)
    expect(result.code).not.toContain(`${LSC.GET_TYPE_DELAY_MARKING}("main", "name"`)
})

test("Intermediate codegen: #then without #await emits fallback wrapper", () => {
    const result = compileIntermediateResult(`<div #then={value}></div>`)

    expect(result.code).toContain(";(")
    expect(result.code).toContain(") => {")
})

test("Intermediate codegen: TypeScript source uses typed default export branch", () => {
    const result = compileIntermediateResult(`
        <lang-ts>
            let count = 0
        </lang-ts>
        <div>{count}</div>
    `)

    expect(result.code).toContain(
        "as __qk__lsu.QingkuaiComponent<ReturnType<typeof __qk__component>>;"
    )
    expect(result.code).not.toContain("/** @type")
})

test("Intermediate codegen: dotted component tag keeps property chain in confirmComponent", () => {
    const result = compileIntermediateResult(`
        <lang-js>
            const NS = { Comp: () => null }
        </lang-js>
        <NS.Comp></NS.Comp>
    `)

    expect(result.code).toContain("__qk__lsu.confirmComponent(NS.Comp)")
})

test("Intermediate codegen: component #slot with invalid value falls back to default slot and writes invalid expression", () => {
    const result = compileIntermediateResult(`
        <lang-js>
            let bad = 1
        </lang-js>
        <Comp>
            <div #slot={}></div>
        </Comp>
    `)

    expect(result.code).toContain("default: (")
})

test("Intermediate codegen: shorthand input reference writes property for validator path", () => {
    const result = compileIntermediateResult(`<input &value>`)

    expect(result.code).toContain(`${LSC.UTIL}.validateString(value);`)
})

test("Intermediate codegen: #slot on non-component writes parsed expression directly", () => {
    const result = compileIntermediateResult(`<div #slot={"main"}></div>`)

    expect(result.code).toContain('"main";')
})

test("Intermediate codegen: component unknown directive expression is flushed as invalid expression", () => {
    const result = compileIntermediateResult(`
        <lang-js>
            let bad = 1
        </lang-js>
        <Comp #unknown={bad}></Comp>
    `)

    expect(result.code).toContain("bad;")
})

test("Intermediate codegen: component dynamic attribute with valid expression writes prop expression", () => {
    const result = compileIntermediateResult(`
        <lang-js>
            let title = "ok"
        </lang-js>
        <Comp !title={title}></Comp>
    `)

    expect(result.code).toContain("title: title,")
})

test("Intermediate codegen: component event with valid expression writes event prop", () => {
    const result = compileIntermediateResult(`
        <lang-js>
            let fn = () => {}
        </lang-js>
        <Comp @click={fn}></Comp>
    `)

    expect(result.code).toContain("click: fn,")
})

test("Intermediate codegen: component event shorthand can be flushed as invalid expression", () => {
    const result = compileIntermediateResult(`<Comp @a-b></Comp>`)

    expect(result.code).toContain("aB,")
})

test("Intermediate codegen: invalid reference shorthand on normal element writes property expression", () => {
    const result = compileIntermediateResult(`<div &foo></div>`)

    expect(result.code).toContain("foo;")
})

test("Intermediate codegen: invalid reference on component is flushed as invalid expression", () => {
    const result = compileIntermediateResult(`
        <lang-js>
            let x = 1
        </lang-js>
        <Comp &foo={x}></Comp>
    `)

    expect(result.code).toContain("foo: x,")
})

test("Intermediate codegen: non-component invalid event expression writes raw value statement", () => {
    const result = compileIntermediateResult(`<button @click={}></button>`)

    expect(result.code).not.toContain("validateEventHandler")
    expect(result.code).toContain("\n  ;")
})

test("Intermediate codegen: export declarations are stripped to declarations", () => {
    const result = compileIntermediateResult(`
        <lang-js>
            export const a = 1
            export function f() { return a }
            const b = 2
            export { b }
        </lang-js>
        <div>{a}</div>
    `)

    expect(result.code).toContain("const a = 1")
    expect(result.code).toContain("function f()")
    expect(result.code).toContain("const b = 2")
    expect(result.code).not.toContain("export const")
    expect(result.code).not.toContain("export function")
    expect(result.code).not.toContain("export { b }")
})

test("Intermediate codegen: component type argument is emitted", () => {
    const result = compileIntermediateResult(`<Comp<string>></Comp>`)

    expect(result.code).toContain("__qk__lsu.confirmComponent(Comp)<string>(")
})

test("Intermediate codegen: slot shorthand dynamic attribute writes type-delay identifier", () => {
    const result = compileIntermediateResult(`
        <slot name="main" !flag></slot>
    `)

    expect(result.code).toContain(`${LSC.GET_TYPE_DELAY_MARKING}("main", "flag", flag);`)
})

test("Intermediate codegen: component invalid dynamic expression is flushed", () => {
    const result = compileIntermediateResult(`<Comp !name={}></Comp>`)

    expect(result.code).toContain("\n  ;")
    expect(result.code).not.toContain("name: {},")
})

test("Intermediate codegen: component invalid event expression is flushed", () => {
    const result = compileIntermediateResult(`<Comp @click={}></Comp>`)

    expect(result.code).toContain("\n  ;")
    expect(result.code).not.toContain("click: {},")
})

test("Intermediate codegen: import declarations are preserved in generated prelude", () => {
    const result = compileIntermediateResult(`
        <lang-js>
            import { readFileSync } from "node:fs"
            const n = 1
        </lang-js>
        <div>{n}</div>
    `)

    expect(result.code).toContain('import { readFileSync } from "node:fs";')
})

test("Intermediate codegen: intrinsic derived function literal is preserved in script output", () => {
    const result = compileIntermediateResult(`
        <lang-ts>
            const d = () => 1
            const v = derived(d)
            const x = derived(() => 2)
        </lang-ts>
        <div>{v} {x}</div>
    `)

    expect(result.code).toContain("const x = derived(() => 2)")
})

test("Intermediate codegen: component implicit default slot encloses children", () => {
    const result = compileIntermediateResult(`
        <Comp>
            <div>child</div>
        </Comp>
    `)

    expect(result.code).toContain("default: () => {")
})

test("Intermediate codegen: invalid #html expression is emitted as invalid statement", () => {
    const result = compileIntermediateResult(`<div #html={}></div>`)

    expect(result.code).not.toContain(`${LSC.UTIL}.validateHtmlBlockOptions(`)
    expect(result.code).toContain("\n  ;")
})

test("Intermediate codegen: invalid #target expression is emitted as invalid statement", () => {
    const result = compileIntermediateResult(`<div #target={}></div>`)

    expect(result.code).not.toContain(`${LSC.UTIL}.validateTargetDirectiveValue(`)
    expect(result.code).toContain("\n  ;")
})

test("Intermediate codegen: #for and #catch without patterns hit invalid pattern branch", () => {
    const result = compileIntermediateResult(`
        <lang-js>
            let p = Promise.resolve(1)
        </lang-js>
        <div #for={}></div>
        <div #catch={}></div>
    `)

    expect(result.code).not.toContain("getListPair(")
    expect(result.code).toMatch(/\n\s*;\n/)
})
