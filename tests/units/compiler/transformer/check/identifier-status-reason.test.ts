import { expect, test } from "vitest"
import { parse } from "@babel/parser"
import { PositionFlag } from "../../../../../src/compiler"
import { inputDescriptor } from "../../../../../src/compiler/state"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"
import { compileIntermediate } from "../../../../../src/compiler/compile"

function expectValidESMSyntax(code: string, label: string) {
    expect(() =>
        parse(code, {
            sourceType: "module",
            sourceFilename: `qingkuai-${label}.mjs`
        })
    ).not.toThrow()
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
        count: "raw (never mutated)"
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
        state: "raw (template unused)",
        getCount: "raw (never mutated)"
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
        state: "raw (template unused)"
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
        config: "raw (explicit raw)"
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
        config: "alias -> props.config"
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
        getLabel: "raw (never mutated)"
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
        count: "reactive",
        inc: "raw (never mutated)"
    })
})
