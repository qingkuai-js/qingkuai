import { test } from "vitest"
import { formatSourceCode } from "../../../../src/util/shared/sundry"
import { analyzeTemplateAndMatchMessages } from "./_match"

const warning = `The "#for" list items contain internal state that may leak between items without a "#key".`

test("Unkeyed #for with reference attributes suggests adding a #key", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <div #for={item of list}>
                <input &value={item.text} />
            </div>
        `),
        [
            {
                type: "warning",
                range: [0, 4],
                value: warning
            }
        ]
    )
})

test("Keyed #for with stateful items emits no warning", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <div #for={item of list} #key={item.id}>
                <input &value={item.text} />
            </div>
        `)
    )
})

test("Pure display lists emit no warning", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <div #for={item of list}>
                <span>{item.text}</span>
            </div>
        `)
    )
})

test("Unkeyed #for with bare form controls emits no warning", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <div #for={item of list}>
                <input />
            </div>
        `)
    )
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <div #for={item of list}>
                <textarea></textarea>
            </div>
        `)
    )
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <div #for={item of list}>
                <select></select>
            </div>
        `)
    )
})

test("A #for descendant with a bare &handle reference counts as stateful", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <div #for={item of list}>
                <div &handle={el}></div>
            </div>
        `),
        [
            {
                type: "warning",
                range: [0, 4],
                value: warning
            }
        ]
    )
})

test("Unkeyed #for with a child component suggests adding a #key", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <div #for={item of list}>
                <ListRow />
            </div>
        `),
        [
            {
                type: "warning",
                range: [0, 4],
                value: warning
            }
        ]
    )
})

test("A #for element holding references itself counts as stateful", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <input #for={item of list} &value={item.text} />
        `),
        [
            {
                type: "warning",
                range: [0, 6],
                value: warning
            }
        ]
    )
})

test("Multiple stateful descendants of one #for emit a single warning", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <div #for={item of list}>
                <span &handle={a}></span>
                <span &handle={b}></span>
            </div>
        `),
        [
            {
                type: "warning",
                range: [0, 4],
                value: warning
            }
        ]
    )
})

test("Nested unkeyed #for reports each stateful list once", () => {
    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <div #for={outer of list}>
                <div #for={inner of outer}>
                    <span &handle={el}></span>
                </div>
            </div>
        `),
        [
            {
                type: "warning",
                range: [0, 4],
                value: warning
            },
            {
                type: "warning",
                range: [31, 35],
                value: warning
            }
        ]
    )
})
