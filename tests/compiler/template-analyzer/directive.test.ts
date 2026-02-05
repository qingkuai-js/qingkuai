import { describe, test } from "vitest"
import { analyzeTemplateAndMatchMessages } from "./_match"
import { formatSourceCode } from "../../../src/util/testing/sundry"

describe("#html", () => {
    test("Without child", () => {
        analyzeTemplateAndMatchMessages(`<div #html></div>`, [
            {
                type: "error",
                range: [0, 17],
                value: `A tag with the "#html" directive must have exactly one text node as its child.`
            }
        ])
    })

    test("Static child", () => {
        analyzeTemplateAndMatchMessages(`<div #html={_}>...</div>`)

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <div #html>
                    <p></p>
                    <span></span>
                </div>
            `),
            [
                {
                    type: "warning",
                    range: [5, 10],
                    value: `This element uses the #html directive without a value, but its content is entirely static, so the directive has no effect and will be ignored.`
                }
            ]
        )
    })
})

describe("#slot", () => {
    test("Invalid placement", () => {
        analyzeTemplateAndMatchMessages(`<div #slot={ item from "xxx" }></div>`, [
            {
                type: "error",
                range: [5, 10],
                value: `The "#slot" directive can only be used on direct child elements of a component node.`
            }
        ])
    })

    test(`Keyword inside pattern`, () => {
        analyzeTemplateAndMatchMessages(`
            <Comp>
                <div #slot={ from from "xxx" }></div>
            </Comp>
        `)
        analyzeTemplateAndMatchMessages(`
            <Comp>
                <div #slot={ [from] from "xxx" }></div>
            </Comp>
        `)
        analyzeTemplateAndMatchMessages(`
            <Comp>
                <div #slot={ { from } from "xxx" }></div>
            </Comp>
        `)
        analyzeTemplateAndMatchMessages(`
            <Comp>
                <div #slot={ { a: from } from "xxx" }></div>
            </Comp>
        `)
        analyzeTemplateAndMatchMessages(`
            <Comp>
                <div #slot={ { from: { from } } from "xxx" }></div>
            </Comp>
        `)
    })

    test("Without pattern", () => {
        analyzeTemplateAndMatchMessages(`
            <Comp>
                <div #slot={"from"}></div>
            </Comp>
        `)
        analyzeTemplateAndMatchMessages(`
            <Comp>
                <div #slot={"default"}></div>
            </Comp>
        `)

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div #slot={a}></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [23, 24],
                    value: `Expected a string literal.`
                }
            ]
        )
    })

    test(`Expression is missing after keyword`, () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div #slot={ item from   }></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [34, 34],
                    value: `Expected a string literal.`
                }
            ]
        )
    })

    test("More than one binding pattern was provided", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div #slot={ ,[] from "xxx" }></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [24, 27],
                    value: `The "#slot" directive accepts at most one binding pattern.`
                }
            ]
        )

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div #slot={ a, b from "xxx" }></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [24, 28],
                    value: `The "#slot" directive accepts at most one binding pattern.`
                }
            ]
        )
    })

    test("Invalid slot name: non-static string", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div #slot={_}></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [23, 24],
                    value: `Expected a string literal.`
                }
            ]
        )

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div #slot={ item from someVar }></div>
                    <div #slot={ item from \`dynamic\${x}\` }></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [34, 41],
                    value: `The "#slot" directive requires a string literal slot name after "from" keyword.`
                },
                {
                    type: "error",
                    range: [78, 91],
                    value: `The "#slot" directive requires a string literal slot name after "from" keyword.`
                }
            ]
        )
    })

    test("No context identifiers were declared by the binding pattern", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div #slot={ {} from "xxx" }></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [24, 26],
                    value: `The context pattern is empty and does not declare any binding identifiers.`
                }
            ]
        )

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div #slot={ [] from "xxx" }></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [24, 26],
                    value: `The context pattern is empty and does not declare any binding identifiers.`
                }
            ]
        )

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div #slot={ { a: [{}] } from "xxx" }></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [24, 35],
                    value: `The context pattern is empty and does not declare any binding identifiers.`
                }
            ]
        )

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <Comp>
                    <div #slot={ { a: [{}, ,] } from "xxx" }></div>
                </Comp>
            `),
            [
                {
                    type: "error",
                    range: [24, 38],
                    value: `The context pattern is empty and does not declare any binding identifiers.`
                }
            ]
        )
    })
})

describe(`#for`, () => {
    test(`Keyword inside pattern or base`, () => {
        analyzeTemplateAndMatchMessages(`<div #for={ of of arr }></div>`)
        analyzeTemplateAndMatchMessages(`<div #for={ { of } of arr }></div>`)
        analyzeTemplateAndMatchMessages(`<div #for={ { a: of } of arr }></div>`)
        analyzeTemplateAndMatchMessages(`<div #for={ item of arr.of }></div>`)
        analyzeTemplateAndMatchMessages(`<div #for={ item of of(arr) }></div>`)
        analyzeTemplateAndMatchMessages(`<div #for={ item of "of" }></div>`)
        analyzeTemplateAndMatchMessages(`<div #for={ item of \`of\` }></div>`)
        analyzeTemplateAndMatchMessages(`<div #for={ item of { of: 1 } }></div>`)
        analyzeTemplateAndMatchMessages(`<div #for={ of of arr.of }></div>`)
        analyzeTemplateAndMatchMessages(`<div #for={ { of } of of(of) }></div>`)
        analyzeTemplateAndMatchMessages(`<div #for={ { a: of } of { of: 1 } }></div>`)
        analyzeTemplateAndMatchMessages(`<div #for={ { of: { of } } of \`of\` }></div>`)
    })

    test("Expression is missing after keyword", () => {
        analyzeTemplateAndMatchMessages(`<div #for={ item of   }></div>`, [
            {
                type: "error",
                range: [20, 20],
                value: `Expected an expression.`
            }
        ])
    })

    test("More then 2 binding patterns were provided", () => {
        analyzeTemplateAndMatchMessages(`<div #for={ a, b, c of arr }></div>`, [
            {
                type: "error",
                range: [12, 19],
                value: `The "#for" directive accepts at most two binding patterns.`
            }
        ])
    })

    test("No context identifiers were declared by the binding patterns", () => {
        analyzeTemplateAndMatchMessages(`<div #for={ {} of arr }></div>`, [
            {
                type: "error",
                range: [12, 14],
                value: `The context pattern is empty and does not declare any binding identifiers.`
            }
        ])

        analyzeTemplateAndMatchMessages(`<div #for={ [] of arr }></div>`, [
            {
                type: "error",
                range: [12, 14],
                value: `The context pattern is empty and does not declare any binding identifiers.`
            }
        ])

        analyzeTemplateAndMatchMessages(`<div #for={ [,] of arr }></div>`, [
            {
                type: "error",
                range: [12, 15],
                value: `The context pattern is empty and does not declare any binding identifiers.`
            }
        ])

        analyzeTemplateAndMatchMessages(`<div #for={ { a: {} } of arr }></div>`, [
            {
                type: "error",
                range: [12, 21],
                value: `The context pattern is empty and does not declare any binding identifiers.`
            }
        ])

        analyzeTemplateAndMatchMessages(`<div #for={ ,{ a: [] } of arr }></div>`, [
            {
                type: "error",
                range: [13, 22],
                value: `The context pattern is empty and does not declare any binding identifiers.`
            }
        ])

        analyzeTemplateAndMatchMessages(`<div #for={ a, { b: { c: [] } } of arr }></div>`, [
            {
                type: "error",
                range: [15, 31],
                value: `The context pattern is empty and does not declare any binding identifiers.`
            }
        ])
    })

    test(`Invalid expression at the first non-whitespace character after keyword`, () => {
        analyzeTemplateAndMatchMessages(`<div #for={ item of    ? }></div>`, [
            {
                type: "error",
                range: [23, 24],
                value: `Invalid expression.`
            }
        ])
    })
})

describe("#then", () => {
    test("Missing preceding directive", () => {
        analyzeTemplateAndMatchMessages(`<div #then={_}></div>`, [
            {
                type: "error",
                range: [5, 10],
                value: `The "#then" directive must be preceded by one of the following directives: "#await", "#catch".`
            }
        ])

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <div #await={_}></div>
                <div #then={_}></div>
            `)
        )
        analyzeTemplateAndMatchMessages(`<div #await={_} #then={_}></div>`)
    })

    test("Invalid binding pattern", () => {
        analyzeTemplateAndMatchMessages(`<div #await={_} #then={call()}></div>`, [
            {
                type: "error",
                range: [23, 29],
                value: `The value for "#then" directive must be a binding pattern.`
            }
        ])

        analyzeTemplateAndMatchMessages(`<div #await={_} #then={context=undefined}></div>`, [
            {
                type: "error",
                range: [23, 40],
                value: `The value for "#then" directive must be a binding pattern.`
            }
        ])

        analyzeTemplateAndMatchMessages(`<div #await={_} #then={[],{}}></div>`, [
            {
                type: "error",
                range: [23, 28],
                value: `The value for "#then" directive must be a binding pattern.`
            }
        ])
    })

    test("No context identifiers were declared by the binding pattern", () => {
        analyzeTemplateAndMatchMessages(`<div #await={_} #then={{ a: [] }}></div>`, [
            {
                type: "error",
                range: [23, 32],
                value: `The context pattern is empty and does not declare any binding identifiers.`
            }
        ])
    })
})

describe("#catch", () => {
    test("Missing preceding directive", () => {
        analyzeTemplateAndMatchMessages(`<span #catch={_}></span>`, [
            {
                type: "error",
                range: [6, 12],
                value: `The "#catch" directive must be preceded by one of the following directives: "#await", "#then".`
            }
        ])

        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
                <p #await={_}></p>
                <p #then={_}></p>
            `)
        )
        analyzeTemplateAndMatchMessages(`<p #await={_} #then={_}></p>`)
    })

    test("Invalid binding pattern", () => {
        analyzeTemplateAndMatchMessages(`<div #await={_} #catch={a + b}></div>`, [
            {
                type: "error",
                range: [24, 29],
                value: `The value for "#catch" directive must be a binding pattern.`
            }
        ])

        analyzeTemplateAndMatchMessages(`<div #await={_} #catch={a ? b : c}></div>`, [
            {
                type: "error",
                range: [24, 33],
                value: `The value for "#catch" directive must be a binding pattern.`
            }
        ])

        analyzeTemplateAndMatchMessages(`<div #await={_} #catch={[], {}}></div>`, [
            {
                type: "error",
                range: [24, 30],
                value: `The value for "#catch" directive must be a binding pattern.`
            }
        ])
    })

    test("No context identifiers were declared by the binding pattern", () => {
        analyzeTemplateAndMatchMessages(`<div #await={_} #catch={[,{ a: [] },]}></div>`, [
            {
                type: "error",
                range: [24, 37],
                value: `The context pattern is empty and does not declare any binding identifiers.`
            }
        ])
    })
})

describe("#else", () => {
    test("Redundant value", () => {
        analyzeTemplateAndMatchMessages(
            formatSourceCode(`
            <div #if={_}></div>
            <div #else = {_}></div>
        `),
            [
                {
                    type: "warning",
                    range: [25, 36],
                    value: `The "#else" directive does not need a value, and the redundant directive value will be ignored.`
                }
            ]
        )
    })

    test("Missing preceding directive", () => {
        analyzeTemplateAndMatchMessages(`<div #else></div>`, [
            {
                type: "error",
                range: [5, 10],
                value: `The "#else" directive requires a preceding sibling node with one of the following directives: "#if", "#elif".`
            }
        ])
    })
})

test("#key: withot for directive", () => {
    analyzeTemplateAndMatchMessages(`<div #for={0} #key={_}></div>`)

    analyzeTemplateAndMatchMessages(`<div #key={_}></div>`, [
        {
            type: "error",
            range: [5, 9],
            value: `The "#key" directive is only allowed on a tag with the "#for" directive.`
        }
    ])
})

test("#elif: missing preceding directive", () => {
    analyzeTemplateAndMatchMessages(`<div #elif={_}></div>`, [
        {
            type: "error",
            range: [5, 10],
            value: `The "#elif" directive requires a preceding sibling node with one of the following directives: "#if", "#elif".`
        }
    ])
})

test("#target: invalid placement", () => {
    analyzeTemplateAndMatchMessages(`<div #target={_}></div>`)
    analyzeTemplateAndMatchMessages(`<Comp #target={"body"} />`)

    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <Comp>
                <div #target={_}></div>
            </Comp>
        `),
        [
            {
                type: "error",
                range: [16, 23],
                value: `The "#target" directive cannot be used on direct component children because they are slot content, which would make the mount target ambiguous. Use it on the <slot> element instead.`
            }
        ]
    )
})

test("Missing directive value", () => {
    analyzeTemplateAndMatchMessages(`<div #if #for #await #key #target #show></div>`, [
        {
            type: "error",
            range: [14, 20],
            value: `Directive "#await" requires a value.`
        },
        {
            type: "error",
            range: [5, 8],
            value: `Directive "#if" requires a value.`
        },
        {
            type: "error",
            range: [26, 33],
            value: `Directive "#target" requires a value.`
        },
        {
            type: "error",
            range: [9, 13],
            value: `Directive "#for" requires a value.`
        },
        {
            type: "error",
            range: [21, 25],
            value: `Directive "#key" requires a value.`
        },
        {
            type: "error",
            range: [34, 39],
            value: `Directive "#show" requires a value.`
        }
    ])

    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <p #if></p>
            <p #elif></p>
            <p #else></p>
        `),
        [
            {
                type: "error",
                range: [3, 6],
                value: `Directive "#if" requires a value.`
            },
            {
                type: "error",
                range: [15, 20],
                value: `Directive "#elif" requires a value.`
            }
        ]
    )

    analyzeTemplateAndMatchMessages(
        formatSourceCode(`
            <Comp>
                <div #slot></div>
            </Comp>
        `),
        [
            {
                type: "error",
                range: [16, 21],
                value: `Directive "#slot" requires a value.`
            }
        ]
    )

    analyzeTemplateAndMatchMessages("<div #html>{_}</div>")
    analyzeTemplateAndMatchMessages(`<div #await={_} #then></div>`)
    analyzeTemplateAndMatchMessages(`<div #await={_} #catch></div>`)
})

test("Unrecognized directives", () => {
    analyzeTemplateAndMatchMessages(`<div #custom={_}></div>`, [
        {
            type: "error",
            range: [5, 12],
            value: `An attribute name beginning with "#" is treated as a directive, but "#custom" is not a recognized directive.`
        }
    ])
})

test("Conflicting directives", () => {
    analyzeTemplateAndMatchMessages(`<div #await={_} #then #catch></div>`, [
        {
            type: "error",
            range: [22, 28],
            value: `Conflicting directives: "#catch" and "#then" cannot be used together.`
        },
        {
            type: "error",
            range: [16, 21],
            value: `Conflicting directives: "#catch" and "#then" cannot be used together.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<div #await={_} #catch #then={res}></div>`, [
        {
            type: "error",
            range: [23, 28],
            value: `Conflicting directives: "#then" and "#catch" cannot be used together.`
        },
        {
            type: "error",
            range: [16, 22],
            value: `Conflicting directives: "#then" and "#catch" cannot be used together.`
        }
    ])

    analyzeTemplateAndMatchMessages(`<div #if={_} #elif={_} #else></div>`, [
        {
            type: "error",
            range: [13, 18],
            value: `Conflicting directives: "#elif" and "#if" cannot be used together.`
        },
        {
            type: "error",
            range: [5, 8],
            value: `Conflicting directives: "#elif" and "#if" cannot be used together.`
        },
        {
            type: "error",
            range: [13, 18],
            value: `The "#elif" directive requires a preceding sibling node with one of the following directives: "#if", "#elif".`
        },
        {
            type: "error",
            range: [23, 28],
            value: `Conflicting directives: "#else" and "#if" cannot be used together.`
        },
        {
            type: "error",
            range: [5, 8],
            value: `Conflicting directives: "#else" and "#if" cannot be used together.`
        },
        {
            type: "error",
            range: [23, 28],
            value: `The "#else" directive requires a preceding sibling node with one of the following directives: "#if", "#elif".`
        }
    ])
})
