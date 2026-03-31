import { test } from "vitest"
import { analyzeTemplateAndMatchMessages } from "./_match"
import { formatSourceCode } from "../../../../src/util/testing/sundry"

test("input", () => {
    analyzeTemplateAndMatchMessages(`<input &dom />`)
    analyzeTemplateAndMatchMessages(`<input &value>`)
    analyzeTemplateAndMatchMessages(`<input &number />`)
    analyzeTemplateAndMatchMessages(`<input &group />`)
    analyzeTemplateAndMatchMessages(`<input type="text" &checked={_} />`)

    analyzeTemplateAndMatchMessages(`<input &type &value />`, [
        {
            type: "error",
            range: [7, 12],
            value: `Invalid reference attribute "&type" on <input>.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<input &custom />`, [
        {
            type: "error",
            range: [7, 14],
            value: `Invalid reference attribute "&custom" on <input>.`
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
            value: `Invalid reference attribute "&checked" on <select>.`
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
        },
        {
            type: "warning",
            range: [0, 10],
            value: `The <qk:spread> tag without children is unnecessary.`
        },
        {
            type: "warning",
            range: [0, 10],
            value: `The <qk:spread> tag without directives is unnecessary.`
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
