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

test("Built-in methods cannot be used in template expressions", () => {
    analyzeTemplateAndMatchMessages(`<div>{reactive(1)}</div>`, [
        {
            type: "error",
            range: [6, 14],
            value: `The built-in method "reactive" cannot be used in template.`
        }
    ])
})

test("raw used in template requires the call form", () => {
    analyzeTemplateAndMatchMessages(`<div>{raw}</div>`, [
        {
            type: "error",
            range: [6, 9],
            value: `The built-in method "raw" must be used in the call form "raw(expr)" when used as an untracked read.`
        }
    ])
})

test("raw passed around in template requires the call form", () => {
    analyzeTemplateAndMatchMessages(`<div>{fn(raw)}</div>`, [
        {
            type: "error",
            range: [9, 12],
            value: `The built-in method "raw" must be used in the call form "raw(expr)" when used as an untracked read.`
        }
    ])
})

test("raw used in template requires an argument", () => {
    analyzeTemplateAndMatchMessages(`<div>{raw()}</div>`, [
        {
            type: "error",
            range: [6, 9],
            value: `The built-in method "raw" must be passed an argument when used as an untracked read.`
        }
    ])
})

test("raw used in template accepts only one argument", () => {
    analyzeTemplateAndMatchMessages(`<div>{raw(a, b)}</div>`, [
        {
            type: "error",
            range: [6, 9],
            value: `The built-in method "raw" can only be passed one argument when used as an untracked read.`
        }
    ])
})

test("nested raw calls only report a warning", () => {
    analyzeTemplateAndMatchMessages(`<div>{raw(raw(a))}</div>`, [
        {
            type: "warning",
            range: [10, 13],
            value: `Nesting "raw" calls is redundant because the argument is already read without tracking.`
        }
    ])
})

test("member access on raw in template requires the call form", () => {
    analyzeTemplateAndMatchMessages(`<div>{raw.x}</div>`, [
        {
            type: "error",
            range: [6, 9],
            value: `The built-in method "raw" must be used in the call form "raw(expr)" when used as an untracked read.`
        }
    ])
})

test("raw callee wrapped in parentheses or type operations is still a raw call", () => {
    analyzeTemplateAndMatchMessages(
        `
        <lang-ts>
            let config = load()
            function load() {
                return { label: "l" }
            }
        </lang-ts>
        <div>{(raw as any)(config)}</div>
        <div>{raw!(config)}</div>
    `,
        []
    )
    const expressions = [...analyzeResult.template.parsedExpressions.values()]
    expect(expressions[0]?.rawCallExpressions).toHaveLength(1)
    expect(expressions[1]?.rawCallExpressions).toHaveLength(1)
})

test("raw read does not promote pending identifiers and records untracked references", () => {
    analyzeTemplateOnly(`
        <lang-js>
            let config = load()
            function load() {
                return { label: "l" }
            }
        </lang-js>
        <div>{raw(config)}</div>
    `)
    expect(analyzeResult.script.topLevelIdentifiers["config"]?.status).toBe("pending")

    const parsedExpression = [...analyzeResult.template.parsedExpressions.values()][0]
    expect(parsedExpression?.reactive).toBe(false)
    expect(parsedExpression?.topLevelReferences["config"]).toEqual([
        { declared: true, range: [4, 10], shorthand: false, untracked: true }
    ])
    expect(analyzeResult.script.topLevelIdentifiers["config"]?.usedExpressions.size).toBe(0)
})

test("identifier promoted by tracked read elsewhere stays untracked in raw expressions", () => {
    analyzeTemplateOnly(`
        <lang-js>
            let count = 0
            function inc() {
                count++
            }
        </lang-js>
        <div>{count}</div><div>{raw(count) + 1}</div>
    `)
    expect(analyzeResult.script.topLevelIdentifiers["count"]?.status).toBe("reactive")

    const expressions = [...analyzeResult.template.parsedExpressions.values()]
    expect(expressions[0]?.reactive).toBe(true)
    expect(expressions[1]?.reactive).toBe(false)
    expect(analyzeResult.script.topLevelIdentifiers["count"]?.usedExpressions.size).toBe(1)
})

test("member accesses of reactive values inside raw arguments are untracked", () => {
    analyzeTemplateOnly(`
        <lang-js>
            let user = reactive({ name: "q", detail: {} })
        </lang-js>
        <div>{user.name + raw(user).detail}</div>
    `)
    const parsedExpression = [...analyzeResult.template.parsedExpressions.values()][0]
    expect(parsedExpression?.reactive).toBe(true)
    expect(parsedExpression?.topLevelReferences["user"].some(item => !item.untracked)).toBe(true)
    expect(parsedExpression?.topLevelReferences["user"].some(item => item.untracked)).toBe(true)
})

test("reference attribute value wrapped with raw is valid and not promoted", () => {
    analyzeTemplateAndMatchMessages(`
        <lang-js>
            let plain = ""
        </lang-js>
        <input &value={raw(plain)} />
    `)
    expect(analyzeResult.script.topLevelIdentifiers["plain"]?.status).toBe("literal")
})

test("props are tracked as intrinsic vars and mark expression reactive", () => {
    analyzeTemplateOnly(`<div>{props.count}</div>`)
    expect(analyzeResult.script.usedIntrinsics.has("props")).toBe(true)

    const parsedExpression = [...analyzeResult.template.parsedExpressions.values()][0]
    expect(parsedExpression?.reactive).toBe(true)
})

test("refs are tracked as intrinsic vars and mark expression reactive", () => {
    analyzeTemplateOnly(`<div>{refs.input}</div>`)
    expect(analyzeResult.script.usedIntrinsics.has("refs")).toBe(true)

    const parsedExpression = [...analyzeResult.template.parsedExpressions.values()][0]
    expect(parsedExpression?.reactive).toBe(true)
})

test("contexts are tracked as intrinsic vars and mark expression reactive", () => {
    analyzeTemplateOnly(`<div>{contexts.theme}</div>`)
    expect(analyzeResult.script.usedIntrinsics.has("contexts")).toBe(true)

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

test("Interpolation reactivity: props and refs access is reactive", () => {
    analyzeTemplateOnly(`<div>{props.count + refs.input}</div>`)
    expect(analyzeResult.script.usedIntrinsics.has("props")).toBe(true)
    expect(analyzeResult.script.usedIntrinsics.has("refs")).toBe(true)

    const parsedExpression = [...analyzeResult.template.parsedExpressions.values()][0]
    expect(parsedExpression?.reactive).toBe(true)
})

test("Interpolation reactivity: plain expression without props or refs is not reactive", () => {
    analyzeTemplateOnly(`<div>{1 + 2}</div>`)

    const parsedExpression = [...analyzeResult.template.parsedExpressions.values()][0]
    expect(parsedExpression?.reactive).toBe(false)
})

test("Interpolation reactivity: non-literal top-level identifier is reactive", () => {
    analyzeTemplateOnly(`
        <lang-js>
            let count = reactive()
        </lang-js>
        <div>{count}</div>
    `)

    const parsedExpression = [...analyzeResult.template.parsedExpressions.values()][0]
    expect(parsedExpression?.reactive).toBe(true)
})

test("Interpolation reactivity: literal top-level identifier is not reactive", () => {
    analyzeTemplateOnly(`
        <lang-js>
            let count = 1
        </lang-js>
        <div>{count}</div>
    `)

    const parsedExpression = [...analyzeResult.template.parsedExpressions.values()][0]
    expect(parsedExpression?.reactive).toBe(false)
})

test("Interpolation reactivity: imported member access is reactive", () => {
    analyzeTemplateOnly(`
        <lang-js>
            import helpers from "./helpers"
        </lang-js>
        <div>{helpers.format()}</div>
    `)

    const parsedExpression = [...analyzeResult.template.parsedExpressions.values()][0]
    expect(parsedExpression?.reactive).toBe(true)
})

test("Interpolation reactivity: imported identifier alone is not reactive", () => {
    analyzeTemplateOnly(`
        <lang-js>
            import helpers from "./helpers"
        </lang-js>
        <div>{helpers}</div>
    `)

    const parsedExpression = [...analyzeResult.template.parsedExpressions.values()][0]
    expect(parsedExpression?.reactive).toBe(false)
})

test("Interpolation reactivity: reactive #for context access is reactive", () => {
    analyzeTemplateOnly(`
        <lang-js>
            let items = reactive()
        </lang-js>
        <div #for={item of items}>
            <span>{item.name}</span>
        </div>
    `)

    const parsedExpression = Array.from(analyzeResult.template.parsedExpressions.values()).find(
        exp => exp?.source.trim() === "item.name"
    )
    expect(parsedExpression).toBeTruthy()
    expect(parsedExpression?.reactive).toBe(true)
})

test("Interpolation reactivity: non-reactive #for context access is not reactive", () => {
    analyzeTemplateOnly(`
        <div #for={item of [1, 2]}>
            <span>{item.name}</span>
        </div>
    `)

    const parsedExpression = Array.from(analyzeResult.template.parsedExpressions.values()).find(
        exp => exp?.source.trim() === "item.name"
    )
    expect(parsedExpression).toBeTruthy()
    expect(parsedExpression?.reactive).toBe(false)
})
