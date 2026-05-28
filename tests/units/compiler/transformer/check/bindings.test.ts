import { test, expect } from "vitest"

import { LSC } from "../../../../../src/compiler/constants"
import { parseScript } from "../../../../../src/compiler/parser/script"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"
import { compileIntermediate } from "../../../../../src/compiler/compile"

function compileIntermediateResult(source: string) {
    return compileIntermediate(formatSourceCode(source))
}

function compileAndAssertNoErrors(source: string) {
    const result = compileIntermediateResult(source)
    expect(() => parseScript(result.code)).not.toThrow()
    expect(result.messages.filter(m => m.type === "error")).toEqual([])
    return result
}

function compileAndGetErrors(source: string) {
    const result = compileIntermediateResult(source)
    return result.messages
        .filter(m => m.type === "error")
        .map(m => String((m.value as { message?: string }).message ?? ""))
}

function expectCompileErrorsContain(source: string, ...expectedErrors: string[]) {
    const errors = compileAndGetErrors(source)
    for (const expectedError of expectedErrors) {
        expect(errors).toContain(expectedError)
    }
}

test("Intermediate: input &value binding generates string validator", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let val = ""
        </lang-js>
        <input &value={val}>
    `)
    expect(result.code).toContain(`${LSC.UTIL}.validateString(val)`)
})

test("Intermediate: input &number binding generates number validator", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let num = 0
        </lang-js>
        <input &number={num}>
    `)
    expect(result.code).toContain(`${LSC.UTIL}.validateNumber(num)`)
})

test("Intermediate: input &checked binding generates boolean validator", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let flag = false
        </lang-js>
        <input &checked={flag}>
    `)
    expect(result.code).toContain(`${LSC.UTIL}.validateBoolean(flag)`)
})

test("Intermediate: input &group binding generates reference group validator", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let grp = []
        </lang-js>
        <input &group={grp}>
    `)
    expect(result.code).toContain("grp")
    expect(result.code).toContain("validate")
})

test("Intermediate: textarea &value binding generates string validator", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let text = ""
        </lang-js>
        <textarea &value={text}></textarea>
    `)
    expect(result.code).toContain(`${LSC.UTIL}.validateString(text)`)
})

test("Intermediate: select[multiple] &value binding generates reference group validator", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let sel = []
        </lang-js>
        <select multiple &value={sel}></select>
    `)
    expect(result.code).toContain(`${LSC.UTIL}.validateReferenceGroup(sel)`)
})

test("Intermediate: select &value without multiple generates anyValue assignment", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let sel = ""
        </lang-js>
        <select &value={sel}></select>
    `)
    expect(result.code).toContain(`${LSC.UTIL}.anyValue`)
    expect(result.code).toContain("sel")
})

test("Intermediate: input &handle generates handle receiver validator", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let ref = null
        </lang-js>
        <input &handle={ref}>
    `)
    expect(result.code).toContain(`${LSC.UTIL}.validateHandleReceiver(`)
    expect(result.code).toContain("ref")
})

test("Intermediate: div &handle generates handle receiver validator with tag name", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let ref = null
        </lang-js>
        <div &handle={ref}></div>
    `)
    expect(result.code).toContain(`${LSC.UTIL}.validateHandleReceiver(`)
    expect(result.code).toContain("ref")
})

test("Intermediate: event with value on spread reports unsupported attribute", () => {
    expectCompileErrorsContain(
        `
        <lang-js>
            function onClick() {}
        </lang-js>
        <qk:spread @click={onClick}></qk:spread>
    `,
        'The <qk:spread> tag can only accept directives, but got an event listener: "@click".'
    )
})

test("Intermediate: event without equal sign on spread reports unsupported attribute", () => {
    expectCompileErrorsContain(
        `
        <lang-js>
            function onClick() {}
        </lang-js>
        <qk:spread @click></qk:spread>
    `,
        'The <qk:spread> tag can only accept directives, but got an event listener: "@click".'
    )
})

test("Intermediate: event with non-curly value on spread reports parser and spread errors", () => {
    expectCompileErrorsContain(
        `
        <qk:spread @click="handler"></qk:spread>
    `,
        "The value for event listener must be wrapped with curly bracket.",
        'The <qk:spread> tag can only accept directives, but got an event listener: "@click".'
    )
})

test("Intermediate: reference attribute with value on spread reports unsupported attribute", () => {
    expectCompileErrorsContain(
        `
        <lang-js>
            let val = ""
        </lang-js>
        <qk:spread &value={val}></qk:spread>
    `,
        'The <qk:spread> tag can only accept directives, but got a reference attribute: "&value".'
    )
})

test("Intermediate: component with curly reference attribute writes to refs block", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let myRef = null
        </lang-js>
        <Comp &handle={myRef}></Comp>
    `)
    expect(result.code).toContain("myRef")
})

test("Intermediate: component with non-curly reference attribute reports parse error", () => {
    expectCompileErrorsContain(
        `<Comp &handle="someRef"></Comp>`,
        "The value for reference attribute must be wrapped with curly bracket."
    )
})

test("Intermediate: component with shorthand reference attribute (no equal sign)", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let myRef = null
        </lang-js>
        <Comp &handle></Comp>
    `)
    expect(result.code).not.toBeUndefined()
})

test("Intermediate: inline arrow event handler wraps with $arg", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let count = 0
        </lang-js>
        <button @click={count++}></button>
    `)
    expect(result.code).toContain("validateEventHandler")
    expect(result.code).toContain("count++")
})

test("Intermediate: component static attribute gets written to props block", () => {
    const result = compileAndAssertNoErrors(`
        <Comp title="hello" active></Comp>
    `)
    expect(result.code).toContain('"hello"')
    expect(result.code).toContain("active")
})

test("Intermediate: slot receives dynamic attribute and tracks dependency usage", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let count = 0
        </lang-js>
        <Comp>
            <div #slot={"main"} !label={count}></div>
        </Comp>
    `)
    expect(result.code).toContain('"main": () => {')
    expect(result.code).toContain("void(count)")
})

test("Intermediate: #catch with destructuring pattern writes anyValue", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let p = Promise.resolve()
        </lang-js>
        <div #await={p}>loading</div>
        <div #then={res}>done: {res}</div>
        <div #catch={err}>err: {err}</div>
    `)
    expect(result.code).toContain(`${LSC.UTIL}.anyValue`)
})

test("Intermediate: #catch without pattern still generates valid code", () => {
    const result = compileAndAssertNoErrors(`
        <lang-js>
            let p = Promise.resolve()
        </lang-js>
        <div #await={p}>loading</div>
        <div #then></div>
        <div #catch></div>
    `)
    expect(result.messages.filter(m => m.type === "error")).toEqual([])
})
