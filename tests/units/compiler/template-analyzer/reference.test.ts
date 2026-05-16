import { test } from "vitest"
import { analyzeTemplateAndMatchMessages } from "./_match"
import { formatSourceCode } from "../../../../src/util/shared/sundry"

test("input", () => {
    analyzeTemplateAndMatchMessages(`<input &handle />`)
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

test("<slot> and <qk:spread> cannot accept any reference attributes", () => {
    analyzeTemplateAndMatchMessages(`<slot &handle></slot>`, [
        {
            type: "error",
            range: [6, 13],
            value: `The <slot> tag does not support reference attributes or event listeners, but got a reference attribute: "&handle".`
        }
    ])

    analyzeTemplateAndMatchMessages(`<qk:spread &handle></qk:spread>`, [
        {
            type: "error",
            range: [11, 18],
            value: `The <qk:spread> tag can only accept directives, but got a reference attribute: "&handle".`
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
            <span &handle={_![_]}></span>
        `)
    )
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <lang-ts></lang-ts>
            <span &handle={_!._}></span>
        `)
    )
    analyzeTemplateAndMatchMessages(`<span &handle></span>`)
    analyzeTemplateAndMatchMessages(`<span &handle={_}></span>`)
    analyzeTemplateAndMatchMessages(`<span &handle={_._}></span>`)
    analyzeTemplateAndMatchMessages(`<span &handle={_[0]}></span>`)
    analyzeTemplateAndMatchMessages(`<span &handle={_[_]}></span>`)

    analyzeTemplateAndMatchMessages(`<span &handle={_?.a}></span>`, [
        {
            type: "error",
            range: [15, 19],
            value: `The value of a reference attribute must be either an identifier or a member expression.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<span &handle={a + b}></span>`, [
        {
            type: "error",
            range: [15, 20],
            value: `The value of a reference attribute must be either an identifier or a member expression.`
        }
    ])
})
