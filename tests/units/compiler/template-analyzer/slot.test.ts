import { describe, test } from "vitest";
import { analyzeTemplateAndMatchMessages } from "./_match";
import { formatSourceCode } from "../../../../src/util/shared/sundry";

describe("Nested slot elements", () => {
    test("Direct nesting reports the inner outlet", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <slot name="a">
                    <slot name="b"></slot>
                </slot>
            `),
            [
                {
                    type: "error",
                    range: [20, 25],
                    value: `Nested <slot> elements are not allowed.`,
                },
            ],
        );
    });

    test("Nesting behind a normal element reports the inner outlet", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <slot name="a">
                    <div>
                        <slot name="b"></slot>
                    </div>
                </slot>
            `),
            [
                {
                    type: "error",
                    range: [34, 39],
                    value: `Nested <slot> elements are not allowed.`,
                },
            ],
        );
    });

    test("Deep nesting reports every nested outlet once", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <slot name="a">
                    <slot name="b">
                        <slot name="c"></slot>
                    </slot>
                </slot>
            `),
            [
                {
                    type: "error",
                    range: [20, 25],
                    value: `Nested <slot> elements are not allowed.`,
                },
                {
                    type: "error",
                    range: [44, 49],
                    value: `Nested <slot> elements are not allowed.`,
                },
            ],
        );
    });
});

describe("Duplicate slot name", () => {
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
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
                {
                    type: "error",
                    range: [0, 5],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
            ],
        );

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <slot></slot>
                <slot name="default"></slot>
            `),
            [
                {
                    type: "error",
                    range: [20, 34],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
                {
                    type: "error",
                    range: [0, 5],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
            ],
        );
    });

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
                    value: `The "name" attribute on <slot> tag must be static.`,
                },
                {
                    type: "error",
                    range: [34, 48],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
                {
                    type: "error",
                    range: [0, 5],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
            ],
        );
    });

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
                    value: `The <slot> tag does not support reference attributes or event listeners, but got a reference attribute: "&name".`,
                },
                {
                    type: "error",
                    range: [20, 25],
                    value: `The "name" attribute on <slot> tag must be static.`,
                },
                {
                    type: "error",
                    range: [14, 19],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
                {
                    type: "error",
                    range: [0, 5],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
            ],
        );
    });
    test("Reports each duplicated slot location once", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <div>
                    <slot></slot>
                    <slot></slot>
                    <slot></slot>
                </div>
            `),
            [
                {
                    type: "error",
                    range: [28, 33],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
                {
                    type: "error",
                    range: [10, 15],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
                {
                    type: "error",
                    range: [46, 51],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
            ],
        );
    });
});

describe("Mutually exclusive slot names", () => {
    test("Slots in #if/#else branches", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <div #if={ok}>
                    <slot></slot>
                </div>
                <div #else>
                    <slot></slot>
                </div>
            `),
        );
    });

    test("Slots in #if/#elif/#else branches", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <div #if={a}>
                    <slot></slot>
                </div>
                <div #elif={b}>
                    <slot name="default"></slot>
                </div>
                <div #else>
                    <slot></slot>
                </div>
            `),
        );
    });

    test("Slots in #await/#then/#catch branches", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <div #await={promise}>
                    <slot></slot>
                </div>
                <div #then={value}>
                    <slot></slot>
                </div>
                <div #catch={error}>
                    <slot></slot>
                </div>
            `),
        );
    });

    test("Text nodes between branches are ignored", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <div #if={ok}>
                    <slot></slot>
                </div>

                plain text

                <div #else>
                    <slot></slot>
                </div>
            `),
        );
    });

    test("Slots carrying the chain directives themselves", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <slot #if={ok}></slot>
                <slot #else></slot>
            `),
        );
    });

    test("Slots in separate #if chains still conflict", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <div #if={a}>
                    <slot></slot>
                </div>
                <div #if={b}>
                    <slot></slot>
                </div>
            `),
            [
                {
                    type: "error",
                    range: [57, 62],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
                {
                    type: "error",
                    range: [18, 23],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
            ],
        );
    });

    test("Slots in the same branch still conflict", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <div #if={a}>
                    <slot></slot>
                    <div>
                        <slot></slot>
                    </div>
                </div>
            `),
            [
                {
                    type: "error",
                    range: [50, 55],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
                {
                    type: "error",
                    range: [18, 23],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
            ],
        );
    });

    test("Slot outside the chain still conflicts", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <div #if={a}>
                    <slot></slot>
                </div>
                <slot></slot>
            `),
            [
                {
                    type: "error",
                    range: [39, 44],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
                {
                    type: "error",
                    range: [18, 23],
                    value: `Duplicate slot name: "default". Consider using a different value for the "name" attribute on one of the <slot> tags.`,
                },
            ],
        );
    });
});

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
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`,
                },
                {
                    type: "error",
                    range: [11, 15],
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`,
                },
            ],
        );

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
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`,
                },
                {
                    type: "error",
                    range: [11, 17],
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`,
                },
                {
                    type: "error",
                    range: [41, 42],
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`,
                },
            ],
        );

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
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`,
                },
                {
                    type: "error",
                    range: [11, 15],
                    value: `Multiple nodes are assigned to the same slot("default") in <Comp>. Consider using a different slot name in the "#slot" directive.`,
                },
            ],
        );
    });

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
                    value: `Multiple nodes are assigned to the same slot("xxx") in <Comp>. Consider using a different slot name in the "#slot" directive.`,
                },
                {
                    type: "error",
                    range: [16, 29],
                    value: `Multiple nodes are assigned to the same slot("xxx") in <Comp>. Consider using a different slot name in the "#slot" directive.`,
                },
            ],
        );
    });
});
