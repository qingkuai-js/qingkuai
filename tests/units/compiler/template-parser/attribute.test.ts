import { describe, test } from "vitest"
import {
    getLocByIndex,
    getPosByIndex,
    newASTLocation,
    getLocWithDefaultEnd
} from "../../../../src/util/compiler/position"
import { formatSourceCode } from "../../../../src/util/shared/sundry"
import { parseTemplateTesting } from "../../../../src/util/testing/sundry"
import { matchTemplateNodeList, matchTemplateNodeListAndMessages } from "./_match"

test("Simple parsing", () => {
    const nodeList = parseTemplateTesting(
        `<a class="link" href="https://qingkuai.dev"> Documentation </a>`
    )
    matchTemplateNodeList(nodeList, {
        tag: "a",
        children: [
            {
                content: [
                    {
                        isInterpolated: false,
                        value: " Documentation ",
                        loc: getLocByIndex(44, 59)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(44, 59)
            }
        ],
        attributes: [
            {
                name: {
                    raw: "class",
                    loc: getLocByIndex(3, 8)
                },
                value: {
                    raw: "link",
                    loc: getLocByIndex(10, 14)
                },
                equalSign: true,
                valueEnclosure: "double",
                loc: getLocByIndex(3, 15)
            },
            {
                name: {
                    raw: "href",
                    loc: getLocByIndex(16, 20)
                },
                value: {
                    raw: "https://qingkuai.dev",
                    loc: getLocByIndex(22, 42)
                },
                equalSign: true,
                valueEnclosure: "double",
                loc: getLocByIndex(16, 43)
            }
        ],
        loc: getLocByIndex(0, 63),
        startTagEndPos: getPosByIndex(44),
        endTagStartPos: getPosByIndex(59)
    })
})

test("Within self-closing tag", () => {
    matchTemplateNodeList(parseTemplateTesting(`<input type="button" value="Click Me" />`), {
        tag: "input",
        attributes: [
            {
                name: {
                    raw: "type",
                    loc: getLocByIndex(7, 11)
                },
                value: {
                    raw: "button",
                    loc: getLocByIndex(13, 19)
                },
                equalSign: true,
                valueEnclosure: "double",
                loc: getLocByIndex(7, 20)
            },
            {
                name: {
                    raw: "value",
                    loc: getLocByIndex(21, 26)
                },
                value: {
                    raw: "Click Me",
                    loc: getLocByIndex(28, 36)
                },
                equalSign: true,
                valueEnclosure: "double",
                loc: getLocByIndex(21, 37)
            }
        ],
        isSelfClosing: true,
        loc: getLocByIndex(0, 40),
        startTagEndPos: getPosByIndex(40)
    })
})

test("With directives", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <ul>
                <li #for={item of 3}> {item} </li>
            </ul>
        `)
    )
    matchTemplateNodeList(nodeList, {
        tag: "ul",
        children: [
            {
                content: [
                    {
                        value: "\n    ",
                        isInterpolated: false,
                        loc: getLocByIndex(4, 9)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(4, 9),
                next: nodeList[0].children[1]
            },
            {
                tag: "li",
                parent: nodeList[0],
                attributes: [
                    {
                        name: {
                            raw: "#for",
                            loc: getLocByIndex(13, 17)
                        },
                        value: {
                            raw: "item of 3",
                            loc: getLocByIndex(19, 28)
                        },
                        equalSign: true,
                        valueEnclosure: "curly",
                        loc: getLocByIndex(13, 29)
                    }
                ],
                children: [
                    {
                        content: [
                            {
                                value: " ",
                                isInterpolated: false,
                                loc: getLocByIndex(30, 31)
                            },
                            {
                                value: "item",
                                isInterpolated: true,
                                loc: getLocByIndex(32, 36)
                            },
                            {
                                value: " ",
                                isInterpolated: false,
                                loc: getLocByIndex(37, 38)
                            }
                        ],
                        loc: getLocByIndex(30, 38),
                        parent: nodeList[0].children[1]
                    }
                ],
                loc: getLocByIndex(9, 43),
                next: nodeList[0].children[2],
                prev: nodeList[0].children[0],
                startTagEndPos: getPosByIndex(30),
                endTagStartPos: getPosByIndex(38)
            },
            {
                content: [
                    {
                        value: "\n",
                        isInterpolated: false,
                        loc: getLocByIndex(43, 44)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(43, 44),
                prev: nodeList[0].children[1]
            }
        ],
        loc: getLocByIndex(0, 49),
        startTagEndPos: getPosByIndex(4),
        endTagStartPos: getPosByIndex(44)
    })
})

test("With dynamic attributes", () => {
    matchTemplateNodeList(parseTemplateTesting(`<div class="container" !id={dynamicId}></div>`), {
        tag: "div",
        attributes: [
            {
                name: {
                    raw: "class",
                    loc: getLocByIndex(5, 10)
                },
                value: {
                    raw: "container",
                    loc: getLocByIndex(12, 21)
                },
                equalSign: true,
                valueEnclosure: "double",
                loc: getLocByIndex(5, 22)
            },
            {
                name: {
                    raw: "!id",
                    loc: getLocByIndex(23, 26)
                },
                value: {
                    raw: "dynamicId",
                    loc: getLocByIndex(28, 37)
                },
                equalSign: true,
                valueEnclosure: "curly",
                loc: getLocByIndex(23, 38)
            }
        ],
        loc: getLocByIndex(0, 45),
        startTagEndPos: getPosByIndex(39),
        endTagStartPos: getPosByIndex(39)
    })
})

test("With reference attributes", () => {
    matchTemplateNodeList(
        parseTemplateTesting(
            formatSourceCode(`
                <span
                    !id={ dynamicId }
                    &dom={span}
                ></span>
            `)
        ),
        {
            tag: "span",
            attributes: [
                {
                    name: {
                        raw: "!id",
                        loc: getLocByIndex(10, 13)
                    },
                    value: {
                        raw: " dynamicId ",
                        loc: getLocByIndex(15, 26)
                    },
                    equalSign: true,
                    valueEnclosure: "curly",
                    loc: getLocByIndex(10, 27)
                },
                {
                    name: {
                        raw: "&dom",
                        loc: getLocByIndex(32, 36)
                    },
                    value: {
                        raw: "span",
                        loc: getLocByIndex(38, 42)
                    },
                    equalSign: true,
                    valueEnclosure: "curly",
                    loc: getLocByIndex(32, 43)
                }
            ],
            loc: getLocByIndex(0, 52),
            startTagEndPos: getPosByIndex(45),
            endTagStartPos: getPosByIndex(45)
        }
    )
})

test("With event listeners", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <button
                @click={
                    () => {
                        console.log("clicked")
                    }
                }
                style="background-color:red;"
            >
                Click Me
            </button>
        `)
    )
    matchTemplateNodeList(nodeList, {
        tag: "button",
        children: [
            {
                content: [
                    {
                        isInterpolated: false,
                        value: "\n    Click Me\n",
                        loc: getLocByIndex(123, 137)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(123, 137)
            }
        ],
        attributes: [
            {
                name: {
                    raw: "@click",
                    loc: getLocByIndex(12, 18)
                },
                value: {
                    loc: getLocByIndex(20, 86),
                    raw: `\n        () => {\n            console.log("clicked")\n        }\n    `
                },
                equalSign: true,
                valueEnclosure: "curly",
                loc: getLocByIndex(12, 87)
            },
            {
                name: {
                    raw: "style",
                    loc: getLocByIndex(92, 97)
                },
                value: {
                    raw: "background-color:red;",
                    loc: getLocByIndex(99, 120)
                },
                equalSign: true,
                valueEnclosure: "double",
                loc: getLocByIndex(92, 121)
            }
        ],
        loc: getLocByIndex(0, 146),
        startTagEndPos: getPosByIndex(123),
        endTagStartPos: getPosByIndex(137)
    })
})

test("Within nested structure", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <div !class={ dynamicClass }>
                <input
                    #if={showInput}
                    !id={dynamicId}
                    &dom={inputElem}
                    @input={handleInput}
                />
            </div>
        `)
    )
    matchTemplateNodeList(nodeList, {
        tag: "div",
        children: [
            {
                content: [
                    {
                        value: "\n    ",
                        isInterpolated: false,
                        loc: getLocByIndex(29, 34)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(29, 34),
                next: nodeList[0].children[1]
            },
            {
                tag: "input",
                attributes: [
                    {
                        name: {
                            raw: "#if",
                            loc: getLocByIndex(49, 52)
                        },
                        value: {
                            raw: "showInput",
                            loc: getLocByIndex(54, 63)
                        },
                        equalSign: true,
                        valueEnclosure: "curly",
                        loc: getLocByIndex(49, 64)
                    },
                    {
                        name: {
                            raw: "!id",
                            loc: getLocByIndex(73, 76)
                        },
                        value: {
                            raw: "dynamicId",
                            loc: getLocByIndex(78, 87)
                        },
                        equalSign: true,
                        valueEnclosure: "curly",
                        loc: getLocByIndex(73, 88)
                    },
                    {
                        name: {
                            raw: "&dom",
                            loc: getLocByIndex(97, 101)
                        },
                        value: {
                            raw: "inputElem",
                            loc: getLocByIndex(103, 112)
                        },
                        equalSign: true,
                        valueEnclosure: "curly",
                        loc: getLocByIndex(97, 113)
                    },
                    {
                        name: {
                            raw: "@input",
                            loc: getLocByIndex(122, 128)
                        },
                        value: {
                            raw: "handleInput",
                            loc: getLocByIndex(130, 141)
                        },
                        equalSign: true,
                        valueEnclosure: "curly",
                        loc: getLocByIndex(122, 142)
                    }
                ],
                parent: nodeList[0],
                isSelfClosing: true,
                loc: getLocByIndex(34, 149),
                prev: nodeList[0].children[0],
                next: nodeList[0].children[2],
                startTagEndPos: getPosByIndex(149)
            },
            {
                content: [
                    {
                        value: "\n",
                        isInterpolated: false,
                        loc: getLocByIndex(149, 150)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(149, 150),
                prev: nodeList[0].children[1]
            }
        ],
        attributes: [
            {
                name: {
                    raw: "!class",
                    loc: getLocByIndex(5, 11)
                },
                value: {
                    raw: " dynamicClass ",
                    loc: getLocByIndex(13, 27)
                },
                equalSign: true,
                valueEnclosure: "curly",
                loc: getLocByIndex(5, 28)
            }
        ],
        loc: getLocByIndex(0, 156),
        startTagEndPos: getPosByIndex(29),
        endTagStartPos: getPosByIndex(150)
    })
})

describe("Whether incorrect format for attribute will cause parsing error", () => {
    const parseRecover = (source: string) => {
        return parseTemplateTesting(source, { recover: true })
    }

    test("Unexpected token in the starting of attribute name", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseRecover(`<a =href=""></a>`),
                {
                    tag: "a",
                    loc: getLocByIndex(0, 16),
                    startTagEndPos: getPosByIndex(12),
                    endTagStartPos: getPosByIndex(12)
                }
            ],
            [
                {
                    type: "error",
                    range: [3, 11],
                    value: "Invalid format for attributes."
                }
            ]
        )

        matchTemplateNodeListAndMessages(
            () => [
                parseRecover(`<input /id="input-name">`),
                {
                    tag: "input",
                    isSelfClosing: true,
                    loc: getLocByIndex(0, 24),
                    startTagEndPos: getPosByIndex(24)
                }
            ],
            [
                {
                    type: "error",
                    range: [7, 23],
                    value: "Invalid format for attributes."
                }
            ]
        )
    })

    test("Unexpected token inside attribute name", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseRecover(`<div class''></div>`),
                {
                    tag: "div",
                    attributes: [
                        {
                            name: {
                                raw: "class",
                                loc: getLocByIndex(5, 10)
                            },
                            value: {
                                raw: "",
                                loc: newASTLocation()
                            },
                            equalSign: false,
                            valueEnclosure: "none",
                            loc: getLocByIndex(5, 10)
                        }
                    ],
                    loc: getLocByIndex(0, 19),
                    startTagEndPos: getPosByIndex(13),
                    endTagStartPos: getPosByIndex(13)
                }
            ],
            [
                {
                    type: "error",
                    range: [10, 12],
                    value: "Invalid format for attributes."
                }
            ]
        )

        matchTemplateNodeListAndMessages(
            () => [
                parseRecover(`<div cla{ss="box"></div>`),
                {
                    tag: "div",
                    attributes: [
                        {
                            name: {
                                raw: "cla",
                                loc: getLocByIndex(5, 8)
                            },
                            value: {
                                raw: "",
                                loc: newASTLocation()
                            },
                            equalSign: false,
                            valueEnclosure: "none",
                            loc: getLocByIndex(5, 8)
                        }
                    ],
                    loc: getLocByIndex(0, 24),
                    startTagEndPos: getPosByIndex(18),
                    endTagStartPos: getPosByIndex(18)
                }
            ],
            [
                {
                    type: "error",
                    range: [8, 17],
                    value: "Invalid format for attributes."
                }
            ]
        )
    })

    test("Attribute value is not quoted", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseRecover(`<div id=container`),
                {
                    tag: "div",
                    attributes: [
                        {
                            name: {
                                raw: "id",
                                loc: getLocByIndex(5, 7)
                            },
                            value: {
                                raw: "container",
                                loc: getLocByIndex(8, 17)
                            },
                            equalSign: true,
                            valueEnclosure: "none",
                            loc: getLocByIndex(5, 17)
                        }
                    ],
                    loc: getLocWithDefaultEnd(0)
                }
            ],
            [
                {
                    type: "error",
                    range: [8, 17],
                    value: "The value for static attribute must be quoted with single or double quote."
                },
                {
                    type: "error",
                    range: [0, 4],
                    value: "The start tag <div> is not closed."
                }
            ]
        )

        matchTemplateNodeListAndMessages(
            () => [
                parseRecover(`<input type="radio" &checked=isChecked />`),
                {
                    tag: "input",
                    attributes: [
                        {
                            name: {
                                raw: "type",
                                loc: getLocByIndex(7, 11)
                            },
                            value: {
                                raw: "radio",
                                loc: getLocByIndex(13, 18)
                            },
                            equalSign: true,
                            valueEnclosure: "double",
                            loc: getLocByIndex(7, 19)
                        },
                        {
                            name: {
                                raw: "&checked",
                                loc: getLocByIndex(20, 28)
                            },
                            value: {
                                raw: "isChecked",
                                loc: getLocByIndex(29, 38)
                            },
                            equalSign: true,
                            valueEnclosure: "none",
                            loc: getLocByIndex(20, 38)
                        }
                    ],
                    isSelfClosing: true,
                    loc: getLocByIndex(0, 41),
                    startTagEndPos: getPosByIndex(41)
                }
            ],
            [
                {
                    type: "error",
                    range: [29, 38],
                    value: "The value for reference attribute must be wrapped with curly bracket."
                }
            ]
        )
    })

    test("Incorrect quotation mark around attribute vaue", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseRecover(
                formatSourceCode(`
                    <div class='container'>
                        <p class={paragraph}>
                            ...
                        </p>
                    </div>
                `)
            )
            return [
                nodeList,
                {
                    tag: "div",
                    children: [
                        {
                            content: [
                                {
                                    value: "\n    ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(23, 28)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(23, 28),
                            next: nodeList[0].children[1]
                        },
                        {
                            tag: "p",
                            children: [
                                {
                                    content: [
                                        {
                                            isInterpolated: false,
                                            value: "\n        ...\n    ",
                                            loc: getLocByIndex(49, 66)
                                        }
                                    ],
                                    loc: getLocByIndex(49, 66),
                                    parent: nodeList[0].children[1]
                                }
                            ],
                            attributes: [
                                {
                                    name: {
                                        raw: "class",
                                        loc: getLocByIndex(31, 36)
                                    },
                                    value: {
                                        raw: "{paragraph}",
                                        loc: getLocByIndex(37, 48)
                                    },
                                    equalSign: true,
                                    valueEnclosure: "none",
                                    loc: getLocByIndex(31, 48)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(28, 70),
                            prev: nodeList[0].children[0],
                            next: nodeList[0].children[2],
                            startTagEndPos: getPosByIndex(49),
                            endTagStartPos: getPosByIndex(66)
                        },
                        {
                            content: [
                                {
                                    value: "\n",
                                    isInterpolated: false,
                                    loc: getLocByIndex(70, 71)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(70, 71),
                            prev: nodeList[0].children[1]
                        }
                    ],
                    attributes: [
                        {
                            name: {
                                raw: "class",
                                loc: getLocByIndex(5, 10)
                            },
                            value: {
                                raw: "container",
                                loc: getLocByIndex(12, 21)
                            },
                            equalSign: true,
                            valueEnclosure: "single",
                            loc: getLocByIndex(5, 22)
                        }
                    ],
                    loc: getLocByIndex(0, 77),
                    startTagEndPos: getPosByIndex(23),
                    endTagStartPos: getPosByIndex(71)
                }
            ]
        }, [
            {
                type: "error",
                range: [37, 48],
                value: "The value for static attribute must be quoted with single or double quote."
            }
        ])

        matchTemplateNodeListAndMessages(
            () => [
                parseRecover(`<a !href=""></a>`),
                {
                    tag: "a",
                    attributes: [
                        {
                            name: {
                                raw: "!href",
                                loc: getLocByIndex(3, 8)
                            },
                            value: {
                                raw: '""',
                                loc: getLocByIndex(9, 11)
                            },
                            equalSign: true,
                            valueEnclosure: "none",
                            loc: getLocByIndex(3, 11)
                        }
                    ],
                    loc: getLocByIndex(0, 16),
                    startTagEndPos: getPosByIndex(12),
                    endTagStartPos: getPosByIndex(12)
                }
            ],
            [
                {
                    type: "error",
                    range: [9, 11],
                    value: "The value for dynamic attribute must be wrapped with curly bracket."
                }
            ]
        )
    })

    test("Unterminated attribute value (no corresponding end quote)", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseRecover(`<input type="radio />`),
                {
                    tag: "input",
                    attributes: [
                        {
                            name: {
                                raw: "type",
                                loc: getLocByIndex(7, 11)
                            },
                            value: {
                                raw: "radio />",
                                loc: getLocWithDefaultEnd(13)
                            },
                            equalSign: true,
                            valueEnclosure: "double",
                            loc: getLocWithDefaultEnd(7)
                        }
                    ],
                    isSelfClosing: true,
                    loc: getLocWithDefaultEnd(0)
                }
            ],
            [
                {
                    type: "error",
                    range: [12, 21],
                    value: "Unclosed static attribute value."
                },
                {
                    type: "error",
                    range: [0, 6],
                    value: "The start tag <input> is not closed."
                }
            ]
        )

        matchTemplateNodeListAndMessages(
            () => [
                parseRecover(`<div !class={ dynamicClass ></div>`),
                {
                    tag: "div",
                    attributes: [
                        {
                            name: {
                                raw: "!class",
                                loc: getLocByIndex(5, 11)
                            },
                            value: {
                                raw: " dynamicClass ></div>",
                                loc: getLocWithDefaultEnd(13)
                            },
                            equalSign: true,
                            valueEnclosure: "curly",
                            loc: getLocWithDefaultEnd(5)
                        }
                    ],
                    loc: getLocWithDefaultEnd(0)
                }
            ],
            [
                {
                    type: "error",
                    range: [12, 34],
                    value: "Unclosed interpolation expression block."
                },
                {
                    type: "error",
                    range: [0, 4],
                    value: "The start tag <div> is not closed."
                }
            ]
        )
    })

    test("Empty interpolation block for attribute value", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseRecover(`<a !href={}></a>`),
                {
                    tag: "a",
                    attributes: [
                        {
                            name: {
                                raw: "!href",
                                loc: getLocByIndex(3, 8)
                            },
                            value: {
                                raw: "",
                                loc: getLocByIndex(10)
                            },
                            equalSign: true,
                            valueEnclosure: "curly",
                            loc: getLocByIndex(3, 11)
                        }
                    ],
                    loc: getLocByIndex(0, 16),
                    startTagEndPos: getPosByIndex(12),
                    endTagStartPos: getPosByIndex(12)
                }
            ],
            [
                {
                    type: "error",
                    range: [9, 11],
                    value: "Empty interpolation expression block is not allowed."
                }
            ]
        )

        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseRecover(
                formatSourceCode(`
                    <div class="container">
                        <input @input = { /* */ } />
                    </div>
                `)
            )
            return [
                nodeList,
                {
                    tag: "div",
                    attributes: [
                        {
                            name: {
                                raw: "class",
                                loc: getLocByIndex(5, 10)
                            },
                            value: {
                                raw: "container",
                                loc: getLocByIndex(12, 21)
                            },
                            equalSign: true,
                            valueEnclosure: "double",
                            loc: getLocByIndex(5, 22)
                        }
                    ],
                    children: [
                        {
                            content: [
                                {
                                    value: "\n    ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(23, 28)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(23, 28),
                            next: nodeList[0].children[1]
                        },
                        {
                            tag: "input",
                            attributes: [
                                {
                                    name: {
                                        raw: "@input",
                                        loc: getLocByIndex(35, 41)
                                    },
                                    value: {
                                        raw: " /* */ ",
                                        loc: getLocByIndex(45, 52)
                                    },
                                    equalSign: true,
                                    valueEnclosure: "curly",
                                    loc: getLocByIndex(35, 53)
                                }
                            ],
                            isSelfClosing: true,
                            parent: nodeList[0],
                            loc: getLocByIndex(28, 56),
                            prev: nodeList[0].children[0],
                            next: nodeList[0].children[2],
                            startTagEndPos: getPosByIndex(56)
                        },
                        {
                            content: [
                                {
                                    value: "\n",
                                    isInterpolated: false,
                                    loc: getLocByIndex(56, 57)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(56, 57),
                            prev: nodeList[0].children[1]
                        }
                    ],
                    loc: getLocByIndex(0, 63),
                    startTagEndPos: getPosByIndex(23),
                    endTagStartPos: getPosByIndex(57)
                }
            ]
        }, [
            {
                type: "error",
                range: [44, 53],
                value: "Empty interpolation expression block is not allowed."
            }
        ])
    })

    test("No name is specified for interpolated attribute", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseRecover(`<Component !={variable} />`),
                {
                    tag: "Component",
                    attributes: [
                        {
                            name: {
                                raw: "!",
                                loc: getLocByIndex(11, 12)
                            },
                            value: {
                                raw: "variable",
                                loc: getLocByIndex(14, 22)
                            },
                            equalSign: true,
                            valueEnclosure: "curly",
                            loc: getLocByIndex(11, 23)
                        }
                    ],
                    isSelfClosing: true,
                    componentTag: "Component",
                    loc: getLocByIndex(0, 26),
                    startTagEndPos: getPosByIndex(26)
                }
            ],
            [
                {
                    type: "error",
                    range: [11, 12],
                    value: "The dynamic attribute must be specified a name."
                }
            ]
        )

        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseRecover(
                formatSourceCode(`
                    <p class='paragraph'>
                        Click <span @={ handleClick }>here</span> to learn more!
                    </p>
                `)
            )
            return [
                nodeList,
                {
                    tag: "p",
                    attributes: [
                        {
                            name: {
                                raw: "class",
                                loc: getLocByIndex(3, 8)
                            },
                            value: {
                                raw: "paragraph",
                                loc: getLocByIndex(10, 19)
                            },
                            equalSign: true,
                            valueEnclosure: "single",
                            loc: getLocByIndex(3, 20)
                        }
                    ],
                    children: [
                        {
                            content: [
                                {
                                    value: "\n    Click ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(21, 32)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(21, 32),
                            next: nodeList[0].children[1]
                        },
                        {
                            tag: "span",
                            attributes: [
                                {
                                    name: {
                                        raw: "@",
                                        loc: getLocByIndex(38, 39)
                                    },
                                    value: {
                                        raw: " handleClick ",
                                        loc: getLocByIndex(41, 54)
                                    },
                                    equalSign: true,
                                    valueEnclosure: "curly",
                                    loc: getLocByIndex(38, 55)
                                }
                            ],
                            children: [
                                {
                                    content: [
                                        {
                                            value: "here",
                                            isInterpolated: false,
                                            loc: getLocByIndex(56, 60)
                                        }
                                    ],
                                    loc: getLocByIndex(56, 60),
                                    parent: nodeList[0].children[1]
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(32, 67),
                            prev: nodeList[0].children[0],
                            next: nodeList[0].children[2],
                            startTagEndPos: getPosByIndex(56),
                            endTagStartPos: getPosByIndex(60)
                        },
                        {
                            content: [
                                {
                                    isInterpolated: false,
                                    value: " to learn more!\n",
                                    loc: getLocByIndex(67, 83)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(67, 83),
                            prev: nodeList[0].children[1]
                        }
                    ],
                    loc: getLocByIndex(0, 87),
                    startTagEndPos: getPosByIndex(21),
                    endTagStartPos: getPosByIndex(83)
                }
            ]
        }, [
            {
                type: "error",
                range: [38, 39],
                value: "The event listener must be specified a name."
            }
        ])
    })

    test("Empty interpolation blocks", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseRecover(
                formatSourceCode(`
                    <div #if={}></div>
                    <span !class={ /* ... */ }></span>
                `)
            )
            return [
                nodeList,
                {
                    tag: "div",
                    attributes: [
                        {
                            name: {
                                raw: "#if",
                                loc: getLocByIndex(5, 8)
                            },
                            value: {
                                raw: "",
                                loc: getLocByIndex(10, 10)
                            },
                            equalSign: true,
                            loc: getLocByIndex(5, 11),
                            valueEnclosure: "curly"
                        }
                    ],
                    next: nodeList[1],
                    loc: getLocByIndex(0, 18),
                    startTagEndPos: getPosByIndex(12),
                    endTagStartPos: getPosByIndex(12)
                },
                {
                    content: [
                        {
                            value: "\n",
                            isInterpolated: false,
                            loc: getLocByIndex(18, 19)
                        }
                    ],
                    prev: nodeList[0],
                    next: nodeList[2],
                    loc: getLocByIndex(18, 19)
                },
                {
                    tag: "span",
                    attributes: [
                        {
                            name: {
                                raw: "!class",
                                loc: getLocByIndex(25, 31)
                            },
                            value: {
                                raw: " /* ... */ ",
                                loc: getLocByIndex(33, 44)
                            },
                            equalSign: true,
                            loc: getLocByIndex(25, 45),
                            valueEnclosure: "curly"
                        }
                    ],
                    prev: nodeList[1],
                    loc: getLocByIndex(19, 53),
                    startTagEndPos: getPosByIndex(46),
                    endTagStartPos: getPosByIndex(46)
                }
            ]
        }, [
            {
                type: "error",
                range: [9, 11],
                value: "Empty interpolation expression block is not allowed."
            },
            {
                type: "error",
                range: [32, 45],
                value: "Empty interpolation expression block is not allowed."
            }
        ])
    })
})
