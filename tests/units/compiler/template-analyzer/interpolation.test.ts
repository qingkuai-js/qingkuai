import { expect, test } from "vitest"
import { analyzeTemplateAndMatchMessages } from "./_match"
import { analyzeResult } from "../../../../src/compiler/state"
import { analyzeScript } from "../../../../src/compiler/analyzer/script"
import { parseTemplateTesting } from "../../../../src/util/testing/sundry"
import { analyzeTemplate } from "../../../../src/compiler/analyzer/template"

function analyzeTemplateOnly(source: string) {
    const nodes = parseTemplateTesting(source, {
        recover: true
    })
    analyzeScript()
    analyzeTemplate(nodes)
    return nodes
}

test("Compiler intrinsic method cannot be used in template expressions", () => {
    analyzeTemplateAndMatchMessages(`<div>{raw(1)}</div>`, [
        {
            type: "error",
            range: [6, 9],
            value: `The compiler intrinsic method "raw" cannot be used in template.`
        }
    ])
})

test("props and refs are tracked as intrinsic vars and mark expression reactive", () => {
    analyzeTemplateOnly(`<div>{props.count + refs.input}</div>`)

    expect(analyzeResult.script.usedIntrinsicVars.has("props")).toBe(true)
    expect(analyzeResult.script.usedIntrinsicVars.has("refs")).toBe(true)

    const parsedExpression = [...analyzeResult.template.parsedExpressions.values()][0]
    expect(parsedExpression?.reactive).toBe(true)
})

test("Kebab shorthand attribute keeps source length by leading spaces", () => {
    const nodes = analyzeTemplateOnly(`<div !foo-bar></div>`)
    const attr = nodes[0].attributes[0]
    const parsedExpression = analyzeResult.template.parsedExpressions.get(attr)
    expect(parsedExpression?.source).toBe(" fooBar")
})

test("Invalid component tag", () => {
    analyzeTemplateAndMatchMessages(`<a..b></a..b>`, [
        {
            type: "error",
            range: [1, 5],
            value: `Invalid component tag: <a..b>. It cannot be converted into a valid JavaScript identifier or member expression.`
        }
    ])
})

test("Invalid shorthand dynamic attribute name reports error", () => {
    analyzeTemplateAndMatchMessages(`<div !for></div>`, [
        {
            type: "error",
            range: [5, 9],
            value: `Invalid name for shorthand dynamic attribute: "!for". It cannot be converted into a valid JavaScript identifier. Please ensure that it is not a reserved word in JavaScript or TypeScript`
        }
    ])
})
