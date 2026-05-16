import { describe, test } from "vitest"
import { analyzeTemplateAndMatchMessages } from "./_match"
import { formatSourceCode } from "../../../../src/util/shared/sundry"

describe("Duplicate slot name", () => {
    test("Nested slot elements", () => {
        analyzeTemplateAndMatchMessages(`<slot name="a"><slot name="b"></slot></slot>`, [
            {
                type: "error",
                range: [0, 5],
                value: `Nested <slot> elements are not allowed.`
            }
        ])
    })

    test("Without name attribute", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <slot></slot>
                <slot></slot>
            `),
            [
                {
                    type: "error",
                    range: [14, 19],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`
                },
                {
                    type: "error",
                    range: [0, 5],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`
                }
            ]
        )

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <slot></slot>
                <slot name="default"></slot>
            `),
            [
                {
                    type: "error",
                    range: [20, 34],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`
                },
                {
                    type: "error",
                    range: [0, 5],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`
                }
            ]
        )
    })

    test("With dynamic name attribute", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <slot !name={"xxx"}></slot>
                <slot name="default"></slot>
            `),
            [
                {
                    type: "error",
                    range: [6, 11],
                    value: `The "name" attribute on <slot> tag must be static.`
                },
                {
                    type: "error",
                    range: [34, 48],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`
                },
                {
                    type: "error",
                    range: [0, 5],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`
                }
            ]
        )
    })

    test("With reference name attribute", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <slot></slot>
                <slot &name></slot>
            `),
            [
                {
                    type: "error",
                    range: [20, 25],
                    value: `The <slot> tag does not support reference attributes or event listeners, but got a reference attribute: "&name".`
                },
                {
                    type: "error",
                    range: [20, 25],
                    value: `The "name" attribute on <slot> tag must be static.`
                },
                {
                    type: "error",
                    range: [14, 19],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`
                },
                {
                    type: "error",
                    range: [0, 5],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`
                }
            ]
        )
    })
})

describe("Duplicate slot assignment", () => {
    test("Without #slot directive", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div></div>
                    <div></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [27, 31],
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`
                },
                {
                    type: "error",
                    range: [11, 15],
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`
                }
            ]
        )

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    hellow
                    <p> world </p>
                    !
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [22, 24],
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`
                },
                {
                    type: "error",
                    range: [11, 17],
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`
                },
                {
                    type: "error",
                    range: [41, 42],
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`
                }
            ]
        )

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div></div>
                    <div #slot={"default"}></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [32, 49],
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`
                },
                {
                    type: "error",
                    range: [11, 15],
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`
                }
            ]
        )
    })

    test("With #slot directive", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div #slot={"xxx"}></div>
                    <div #slot={context from \`xxx\`}></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [46, 72],
                    value: `Multiple nodes are assigned to the same slot("xxx") in <Comp>. Consider using a different slot name in the "#slot" directive.`
                },
                {
                    type: "error",
                    range: [16, 29],
                    value: `Multiple nodes are assigned to the same slot("xxx") in <Comp>. Consider using a different slot name in the "#slot" directive.`
                }
            ]
        )
    })
})
