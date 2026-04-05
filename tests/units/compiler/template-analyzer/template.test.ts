import { describe, test } from "vitest"
import { analyzeTemplateAndMatchMessages } from "./_match"
import { formatSourceCode } from "../../../../src/util/shared/sundry"

describe("Template-level checks", () => {
    test("Component type argument requires TypeScript embedded script", () => {
        analyzeTemplateAndMatchMessages(`<Comp<Result<string>>></Comp>`, [
            {
                type: "error",
                range: [5, 22],
                value: `Component type arguments are only allowed when the embedded script block uses TypeScript.`
            }
        ])
    })

    test("Component type argument is allowed with embedded TypeScript block", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <lang-ts></lang-ts>
                <Comp<Result<string>>></Comp>
            `)
        )
    })
})

describe("qk:spread", () => {
    test("Warn without children and directives", () => {
        analyzeTemplateAndMatchMessages(`<qk:spread></qk:spread>`, [
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

    test("Warn without directives when used at top-level", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <qk:spread>
                    <div></div>
                </qk:spread>
            `),
            [
                {
                    type: "warning",
                    range: [0, 10],
                    value: `The <qk:spread> tag without directives is unnecessary.`
                }
            ]
        )
    })

    test("No warning when has children and directives", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <qk:spread #if={ok}>
                    <div></div>
                </qk:spread>
            `)
        )
    })

    test("No directives warning when parent is a component", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <qk:spread>
                        <div></div>
                    </qk:spread>
                </Comp>
            `)
        )
    })
})
