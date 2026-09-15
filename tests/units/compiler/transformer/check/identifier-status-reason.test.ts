import { expect, test } from "vitest"
import { PositionFlag } from "../../../../../src/compiler"
import { inputDescriptor } from "../../../../../src/compiler/state"
import { parseScript } from "../../../../../src/compiler/parser/script"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"
import { compileIntermediate } from "../../../../../src/compiler/compile"
import { matchCompileMessages } from "../../../../../src/util/testing/match"

function expectValidESMSyntax(code: string, label: string) {
    expect(() => parseScript(code), label).not.toThrow()
}

function compileIntermediateAndAssertNoErrors(source: string, label: string) {
    const result = compileIntermediate(source)
    expect(result.messages.filter(msg => msg.type === "error")).toEqual([])
    expectValidESMSyntax(result.code, `${label}-intermediate`)
    if (inputDescriptor.script.existing) {
        for (
            let i = inputDescriptor.script.loc.start.index;
            i < inputDescriptor.script.loc.end.index;
            i++
        ) {
            expect(result.isPositionFlagSetAtIndex(PositionFlag.InScript, i)).toBe(true)
        }
    }
    return result
}

test("Intermediate: inferred raw reason is unmutated for literal used in template", () => {
    const source = formatSourceCode(`
        <lang-js>
            let count = 1
        </lang-js>

        <p>{ count }</p>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-unmutated")
    expect(result.identifierStatusInfo).toMatchObject({
        count: {
            description: "raw (never mutated)"
        }
    })
})

test("Intermediate: function call in template does not count as direct identifier access", () => {
    const source = formatSourceCode(`
        <lang-js>
            let state = { count: 0 }
            function getCount() {
                return state.count
            }
        </lang-js>

        <p>{ getCount() }</p>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-indirect-access")
    expect(result.identifierStatusInfo).toMatchObject({
        state: {
            description: "raw (unused in template)"
        },
        getCount: {
            description: "raw (never mutated)"
        }
    })
})

test("Intermediate: object literal not used in template is raw with not-accessed reason", () => {
    const source = formatSourceCode(`
        <lang-js>
            let state = { count: 0 }
        </lang-js>

        <p>static text</p>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-not-accessed")
    expect(result.identifierStatusInfo).toMatchObject({
        state: {
            description: "raw (unused in template)"
        }
    })
})

test("Intermediate: explicit raw marker carries explicit raw reason", () => {
    const source = formatSourceCode(`
        <lang-js>
            const config = raw({ value: 1 })
        </lang-js>

        <p>{ config.value }</p>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-explicit-raw")
    expect(result.identifierStatusInfo).toMatchObject({
        config: {
            description: "raw (explicit raw)"
        }
    })
})

test("Intermediate: alias marker carries alias reason", () => {
    const source = formatSourceCode(`
        <lang-js>
            const config = alias(props.config)
        </lang-js>

        <p>{ config }</p>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-alias")
    expect(result.identifierStatusInfo).toMatchObject({
        config: {
            description: "alias -> props.config"
        }
    })
})

test("Intermediate: function declaration stays raw even when called in template", () => {
    const source = formatSourceCode(`
        <lang-js>
            function getLabel() {
                return "ok"
            }
        </lang-js>

        <p>{ getLabel() }</p>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-function-used")
    expect(result.identifierStatusInfo).toMatchObject({
        getLabel: {
            description: "raw (never mutated)"
        }
    })
})

test("Intermediate: literal used and then mutated becomes reactive", () => {
    const source = formatSourceCode(`
        <lang-js>
            let count = 1
            function inc() {
                count++
            }
        </lang-js>

        <p>{ count }</p>
        <button @click={inc}>+</button>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-literal-mutated")
    expect(result.identifierStatusInfo).toMatchObject({
        count: {
            status: "reactive"
        },
        inc: {
            description: "raw (never mutated)"
        }
    })
})

test("Intermediate: const function literal used in template is implicit raw", () => {
    const source = formatSourceCode(`
        <lang-js>
            const getValue = () => 1
        </lang-js>

        <p>{ getValue }</p>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-implicit-raw")
    expect(result.identifierStatusInfo).toMatchObject({
        getValue: {
            description: "raw (implicit raw)"
        }
    })
})

test("Intermediate: reactive mark on const literal is downgraded to raw", () => {
    const source = formatSourceCode(`
        <lang-js>
            const value = reactive(1)
        </lang-js>

        <p>{ value }</p>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-downgraded-raw")
    expect(result.identifierStatusInfo).toMatchObject({
        value: {
            description: "raw (downgraded)"
        }
    })
})

test("Intermediate: shallow intrinsic keeps shallow status", () => {
    const source = formatSourceCode(`
        <lang-js>
            let state = shallow({ n: 1 })
        </lang-js>

        <p>{ state.n }</p>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-shallow")
    expect(result.identifierStatusInfo).toMatchObject({
        state: {
            status: "shallow"
        }
    })
})

test("Intermediate: derived intrinsic keeps derived status", () => {
    const source = formatSourceCode(`
        <lang-js>
            let value = derived(() => 1)
        </lang-js>

        <p>{ value }</p>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-derived")
    expect(result.identifierStatusInfo).toMatchObject({
        value: {
            status: "derived"
        }
    })
})

test("Intermediate: identifier only read inside raw is marked untracked in template", () => {
    const source = formatSourceCode(`
        <lang-js>
            let config = { value: 1 }
        </lang-js>

        <p>{ raw(config).value }</p>
    `)
    const result = compileIntermediateAndAssertNoErrors(source, "id-status-untracked")
    expect(result.identifierStatusInfo).toMatchObject({
        config: {
            description: "raw (untracked in template)"
        }
    })
})

test("Intermediate: alias to a plain identifier is reported as invalid alias", () => {
    const source = formatSourceCode(`
        <lang-js>
            let source = { value: 1 }
            const config = alias(source)
        </lang-js>

        <p>{ config.value }</p>
    `)
    const result = compileIntermediate(source)
    matchCompileMessages([
        {
            type: "error",
            range: [59, 72],
            value: `The "alias" built-in method cannot be used to create an alias for a standalone identifier.`
        }
    ])
    expect(result.identifierStatusInfo).toMatchObject({
        config: {
            description: "alias (invalid)"
        }
    })
})

test("Intermediate: alias ignores arguments after the first", () => {
    const source = formatSourceCode(`
        <lang-js>
            const a = alias(props.config, fallback)
        </lang-js>

        <p>{ a.value }</p>
    `)
    const result = compileIntermediate(source)
    matchCompileMessages([])
    expect(result.identifierStatusInfo).toMatchObject({
        a: {
            description: "alias -> props.config"
        }
    })
})

test("Intermediate: alias with a non-lvalue first argument is reported as invalid alias", () => {
    const source = formatSourceCode(`
        <lang-js>
            const b = alias(1)
        </lang-js>

        <p>{ b }</p>
    `)
    const result = compileIntermediate(source)
    matchCompileMessages([
        {
            type: "error",
            range: [24, 32],
            value: `The built-in method "alias" must accept exactly one mutable target(lvalue) as its argument.`
        }
    ])
    expect(result.identifierStatusInfo).toMatchObject({
        b: {
            description: "alias (invalid)"
        }
    })
})

test("Intermediate: alias with a spread first argument is reported as invalid alias", () => {
    const source = formatSourceCode(`
        <lang-js>
            const c = alias(...items)
        </lang-js>

        <p>{ c.value }</p>
    `)
    const result = compileIntermediate(source)
    matchCompileMessages([
        {
            type: "error",
            range: [30, 38],
            value: `The built-in method "alias" does not support spread element as its argument.`
        }
    ])
    expect(result.identifierStatusInfo).toMatchObject({
        c: {
            description: "alias (invalid)"
        }
    })
})
