import { test } from "vitest"
import { analyzeTemplateAndMatchMessages } from "./_match"
import { formatSourceCode } from "../../../src/util/testing/sundry"

test("input(text)", () => {
    analyzeTemplateAndMatchMessages(`<input &dom />`)
    analyzeTemplateAndMatchMessages(`<input &value>`)
    analyzeTemplateAndMatchMessages(`<input &value />`)

    analyzeTemplateAndMatchMessages(`<input &type &value />`, [
        {
            type: "error",
            range: [7, 12],
            value: `The <input type="text"> tag can only accept "&dom" or "&value" as reference attribute, but got: "&type".`
        }
    ])

    analyzeTemplateAndMatchMessages(`<input &custom />`, [
        {
            type: "error",
            range: [7, 14],
            value: `The <input type="text"> tag can only accept "&dom" or "&value" as reference attribute, but got: "&custom".`
        }
    ])

    analyzeTemplateAndMatchMessages(`<input type="text" &checked={_} />`, [
        {
            type: "error",
            range: [19, 27],
            value: `The <input type="text"> tag can only accept "&dom" or "&value" as reference attribute, but got: "&checked".`
        }
    ])
})

test("input(radio)", () => {
    analyzeTemplateAndMatchMessages(`<input type="radio" &checked />`)

    analyzeTemplateAndMatchMessages(`<input type="radio" &custom>`, [
        {
            type: "error",
            range: [20, 27],
            value: `The <input type="radio"> tag can only accept "&dom" or "&checked" as reference attribute, but got: "&custom".`
        }
    ])
})

test("input(checkbox)", () => {
    analyzeTemplateAndMatchMessages(`<input type="checkbox" &checked={_} />`)

    analyzeTemplateAndMatchMessages(`<input type="checkbox" &value />`, [
        {
            type: "error",
            range: [23, 29],
            value: `The <input type="checkbox"> tag can only accept "&dom" or "&checked" as reference attribute, but got: "&value".`
        }
    ])
})

test("select", () => {
    analyzeTemplateAndMatchMessages(`<select &value></select>`)
    analyzeTemplateAndMatchMessages(`<select &value={_}></select>`)

    analyzeTemplateAndMatchMessages(`<select &checked></select>`, [
        {
            type: "error",
            range: [8, 16],
            value: `The <select> tag can only accept "&dom" or "&value" as reference attribute, but got: "&checked".`
        }
    ])
})

test("Dynamic type attribute on input", () => {
    analyzeTemplateAndMatchMessages(`<input !type &value />`, [
        {
            type: "error",
            range: [13, 19],
            value: `The <input> tag with dynamic "type" attribute can only accept "&dom" as reference attribute, but got: "&value".`
        }
    ])
})

test("Dynamic multiple attribute on select", () => {
    analyzeTemplateAndMatchMessages(`<select !multiple &value></select>`, [
        {
            type: "error",
            range: [18, 24],
            value: `The <select> tag with dynamic "multiple" attribute can only accept "&dom" as reference attribute, but got: "&value".`
        }
    ])
})

test("&dom on component has no special effect", () => {
    analyzeTemplateAndMatchMessages(`<Comp &dom />`, [
        {
            type: "warning",
            range: [6, 10],
            value: `Using "&dom" on a component will not assign the DOM element to the target. It behaves like a normal reference attribute.`
        }
    ])
})

test("<slot> and <qk:spread> cannot accept any reference attributes", () => {
    analyzeTemplateAndMatchMessages(`<slot &dom></slot>`, [
        {
            type: "error",
            range: [6, 10],
            value: `The <slot> tag does not support reference attributes or event listeners, but got a reference attribute: "&dom".`
        }
    ])

    analyzeTemplateAndMatchMessages(`<qk:spread &dom></qk:spread>`, [
        {
            type: "error",
            range: [11, 15],
            value: `The <qk:spread> tag can only accept directives, but got a reference attribute: "&dom".`
        }
    ])
})

test("Invalid value for reference attribute", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <lang-ts></lang-ts>
            <span &dom={_![_]}></span>
        `)
    )
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <lang-ts></lang-ts>
            <span &dom={_!._}></span>
        `)
    )
    analyzeTemplateAndMatchMessages(`<span &dom></span>`)
    analyzeTemplateAndMatchMessages(`<span &dom={_}></span>`)
    analyzeTemplateAndMatchMessages(`<span &dom={_._}></span>`)
    analyzeTemplateAndMatchMessages(`<span &dom={_[0]}></span>`)
    analyzeTemplateAndMatchMessages(`<span &dom={_[_]}></span>`)

    analyzeTemplateAndMatchMessages(`<span &dom={_?.a}></span>`, [
        {
            type: "error",
            range: [12, 16],
            value: `The value of a reference attribute must be either an identifier or a member expression.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<span &dom={a + b}></span>`, [
        {
            type: "error",
            range: [12, 17],
            value: `The value of a reference attribute must be either an identifier or a member expression.`
        }
    ])
})
