import {
    matchTemplateNodeList,
    matchTemplateNodeListAndMessages
} from "../../../src/util/testing/match"
import { describe, it, test } from "vitest"
import { formatSourceCode } from "../../../src/util/testing/sundry"
import { parseTemplateStandalone } from "../../../src/compiler/parser/template"
import { getLocByIndex, getPosByIndex } from "../../../src/util/compiler/position"

test("Wheter comment nodes were removed from parse result", () => {
    const nodeList = parseTemplateStandalone(
        formatSourceCode(`
            <!-- xxx -->
            <div class="container">
                <!-- text content -->
            </div>
        `),
        { reseveCommentNodes: false }
    )
    matchTemplateNodeList(
        nodeList,
        {
            content: [
                {
                    value: "\n",
                    isInterpolated: false,
                    loc: getLocByIndex(12, 13)
                }
            ],
            next: nodeList[1],
            loc: getLocByIndex(12, 13)
        },
        {
            tag: "div",
            attributes: [
                {
                    key: {
                        raw: "class",
                        loc: getLocByIndex(18, 23)
                    },
                    value: {
                        raw: "container",
                        loc: getLocByIndex(25, 34)
                    },
                    quote: "double",
                    loc: getLocByIndex(18, 35)
                }
            ],
            children: [
                {
                    content: [
                        {
                            value: "\n    ",
                            isInterpolated: false,
                            loc: getLocByIndex(36, 41)
                        }
                    ],
                    parent: nodeList[1],
                    loc: getLocByIndex(36, 41),
                    next: nodeList[1].children[1]
                },
                {
                    content: [
                        {
                            value: "\n",
                            isInterpolated: false,
                            loc: getLocByIndex(62, 63)
                        }
                    ],
                    parent: nodeList[1],
                    loc: getLocByIndex(62, 63),
                    prev: nodeList[1].children[0]
                }
            ],
            prev: nodeList[0],
            loc: getLocByIndex(13, 69),
            startTagEndPos: getPosByIndex(36),
            endTagStartPos: getPosByIndex(63)
        }
    )
})

test("Whether conditional comment nodes were always preserved", () => {
    const nodeList = parseTemplateStandalone(
        formatSourceCode(`
            <!--[if lte IE 8]>
                This will be displayed in IE8 or lower
            <![endif]-->
            <!--[if !IE]> -->
                This will be displayed in non-IE browsers
            <!-- <![endif]-->
        `),
        { reseveCommentNodes: false }
    )
    matchTemplateNodeList(
        nodeList,
        {
            tag: "!",
            content: [
                {
                    isInterpolated: false,
                    loc: getLocByIndex(4, 71),
                    value: "[if lte IE 8]>\n    This will be displayed in IE8 or lower\n<![endif]"
                }
            ],
            next: nodeList[1],
            loc: getLocByIndex(0, 74),
            startTagEndPos: getPosByIndex(4),
            endTagStartPos: getPosByIndex(71)
        },
        {
            content: [
                {
                    value: "\n",
                    isInterpolated: false,
                    loc: getLocByIndex(74, 75)
                }
            ],
            prev: nodeList[0],
            next: nodeList[2],
            loc: getLocByIndex(74, 75)
        },
        {
            tag: "!",
            content: [
                {
                    value: "[if !IE]> ",
                    isInterpolated: false,
                    loc: getLocByIndex(79, 89)
                }
            ],
            prev: nodeList[1],
            next: nodeList[3],
            loc: getLocByIndex(75, 92),
            startTagEndPos: getPosByIndex(79),
            endTagStartPos: getPosByIndex(89)
        },
        {
            content: [
                {
                    isInterpolated: false,
                    loc: getLocByIndex(92, 139),
                    value: "\n    This will be displayed in non-IE browsers\n"
                }
            ],
            prev: nodeList[2],
            next: nodeList[4],
            loc: getLocByIndex(92, 139)
        },
        {
            tag: "!",
            content: [
                {
                    value: " <![endif]",
                    isInterpolated: false,
                    loc: getLocByIndex(143, 153)
                }
            ],
            prev: nodeList[3],
            loc: getLocByIndex(139, 156),
            startTagEndPos: getPosByIndex(143),
            endTagStartPos: getPosByIndex(153)
        }
    )
})

describe("Whether invalid template structure will cause parsing error", () => {
    const parseAndCheckStructure = (source: string) => {
        return parseTemplateStandalone(source, {
            recover: true,
            structureCheck: true
        })
    }

    test("Disallowed tag is used", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseTemplateStandalone(`<html> <frameset></frameset> </html>`, {
                    recover: true
                })
            ],
            [
                {
                    type: "error",
                    range: [0, 5],
                    value: "The <html> tag can not be used in components file, as it can not be embedded inside <body>, however you can define it in the entry HTML file."
                }
            ]
        )
    })

    test("Unexpected child for `table`", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(
                formatSourceCode(`
                        <table>
                            <div></div>
                        </table>
                    `)
            )
            return [
                nodeList,
                {
                    tag: "table",
                    children: [
                        {
                            content: [
                                {
                                    value: "\n    ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(7, 12)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(7, 12),
                            next: nodeList[0].children[1]
                        },
                        {
                            content: [
                                {
                                    value: "\n",
                                    isInterpolated: false,
                                    loc: getLocByIndex(23, 24)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(23, 24),
                            prev: nodeList[0].children[0]
                        }
                    ],
                    loc: getLocByIndex(0, 32),
                    startTagEndPos: getPosByIndex(7),
                    endTagStartPos: getPosByIndex(24)
                }
            ]
        }, [
            {
                type: "error",
                range: [12, 16],
                value: "Invalid template structure: the <div> tag can not be nested in <table>."
            }
        ])
    })

    test("Unexpected child for `tr`", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(
                formatSourceCode(`
                        <table>
                            <tbody>
                                <tr>
                                    <p> ... </p>
                                </tr>
                            </tbody>
                        </table>
                    `)
            )
            return [
                nodeList,
                {
                    tag: "table",
                    children: [
                        {
                            content: [
                                {
                                    value: "\n    ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(7, 12)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(7, 12),
                            next: nodeList[0].children[1]
                        },
                        {
                            tag: "tbody",
                            children: [
                                {
                                    content: [
                                        {
                                            value: "\n        ",
                                            isInterpolated: false,
                                            loc: getLocByIndex(19, 28)
                                        }
                                    ],
                                    loc: getLocByIndex(19, 28),
                                    parent: nodeList[0].children[1],
                                    next: nodeList[0].children[1].children[1]
                                },
                                {
                                    tag: "tr",
                                    children: [
                                        {
                                            content: [
                                                {
                                                    isInterpolated: false,
                                                    value: "\n            ",
                                                    loc: getLocByIndex(32, 45)
                                                }
                                            ],
                                            loc: getLocByIndex(32, 45),
                                            parent: nodeList[0].children[1].children[1],
                                            next: nodeList[0].children[1].children[1].children[1]
                                        },
                                        {
                                            content: [
                                                {
                                                    value: "\n        ",
                                                    isInterpolated: false,
                                                    loc: getLocByIndex(57, 66)
                                                }
                                            ],
                                            loc: getLocByIndex(57, 66),
                                            parent: nodeList[0].children[1].children[1],
                                            prev: nodeList[0].children[1].children[1].children[0]
                                        }
                                    ],
                                    loc: getLocByIndex(28, 71),
                                    parent: nodeList[0].children[1],
                                    startTagEndPos: getPosByIndex(32),
                                    endTagStartPos: getPosByIndex(66),
                                    prev: nodeList[0].children[1].children[0],
                                    next: nodeList[0].children[1].children[2]
                                },
                                {
                                    content: [
                                        {
                                            value: "\n    ",
                                            isInterpolated: false,
                                            loc: getLocByIndex(71, 76)
                                        }
                                    ],
                                    loc: getLocByIndex(71, 76),
                                    parent: nodeList[0].children[1],
                                    prev: nodeList[0].children[1].children[1]
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(12, 84),
                            prev: nodeList[0].children[0],
                            next: nodeList[0].children[2],
                            startTagEndPos: getPosByIndex(19),
                            endTagStartPos: getPosByIndex(76)
                        },
                        {
                            content: [
                                {
                                    value: "\n",
                                    isInterpolated: false,
                                    loc: getLocByIndex(84, 85)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(84, 85),
                            prev: nodeList[0].children[1]
                        }
                    ],
                    loc: getLocByIndex(0, 93),
                    startTagEndPos: getPosByIndex(7),
                    endTagStartPos: getPosByIndex(85)
                }
            ]
        }, [
            {
                type: "error",
                range: [45, 47],
                value: "Invalid template structure: the <p> tag can not be nested in <tr>."
            }
        ])
    })

    test("Unexpected parent for `tr`", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(
                formatSourceCode(`
                        <div>
                            <tr></tr>
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
                                    loc: getLocByIndex(5, 10)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(5, 10),
                            next: nodeList[0].children[1]
                        },
                        {
                            content: [
                                {
                                    value: "\n",
                                    isInterpolated: false,
                                    loc: getLocByIndex(19, 20)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(19, 20),
                            prev: nodeList[0].children[0]
                        }
                    ],
                    loc: getLocByIndex(0, 26),
                    startTagEndPos: getPosByIndex(5),
                    endTagStartPos: getPosByIndex(20)
                }
            ]
        }, [
            {
                type: "error",
                range: [10, 13],
                value: "Invalid template structure: the <tr> tag can not be nested in <div>, it can only be nested in these tags: <thead>, <tbody> or <tfoot>."
            }
        ])
    })

    test("A `li` tag is nested in another `li` element", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseAndCheckStructure(`<li><li></li></li>`),
                {
                    tag: "li",
                    loc: getLocByIndex(0, 18),
                    startTagEndPos: getPosByIndex(4),
                    endTagStartPos: getPosByIndex(13)
                }
            ],
            [
                {
                    type: "error",
                    range: [4, 7],
                    value: "Invalid template structure: the <li> tag can not be nested in <li>."
                }
            ]
        )
    })

    test("An `a` tag is the descendant of another `a` element", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(`<a><span><a></a></span></a>`)
            return [
                nodeList,
                {
                    tag: "a",
                    children: [
                        {
                            tag: "span",
                            parent: nodeList[0],
                            loc: getLocByIndex(3, 23),
                            startTagEndPos: getPosByIndex(9),
                            endTagStartPos: getPosByIndex(16)
                        }
                    ],
                    loc: getLocByIndex(0, 27),
                    startTagEndPos: getPosByIndex(3),
                    endTagStartPos: getPosByIndex(23)
                }
            ]
        }, [
            {
                type: "error",
                range: [9, 11],
                value: "Invalid template structure: the <a> tag can not be descendant of <a>."
            }
        ])
    })

    test("A `dt` tag is the descendant of another `dt` element", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(
                formatSourceCode(`
                        <dt>
                            <p>
                                <dt></dt>
                            </p>
                        </dt>
                    `)
            )
            return [
                nodeList,
                {
                    tag: "dt",
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
                            tag: "p",
                            children: [
                                {
                                    content: [
                                        {
                                            value: "\n        ",
                                            isInterpolated: false,
                                            loc: getLocByIndex(12, 21)
                                        }
                                    ],
                                    loc: getLocByIndex(12, 21),
                                    parent: nodeList[0].children[1],
                                    next: nodeList[0].children[1].children[1]
                                },
                                {
                                    content: [
                                        {
                                            value: "\n    ",
                                            isInterpolated: false,
                                            loc: getLocByIndex(30, 35)
                                        }
                                    ],
                                    loc: getLocByIndex(30, 35),
                                    parent: nodeList[0].children[1],
                                    prev: nodeList[0].children[1].children[0]
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(9, 39),
                            prev: nodeList[0].children[0],
                            next: nodeList[0].children[2],
                            startTagEndPos: getPosByIndex(12),
                            endTagStartPos: getPosByIndex(35)
                        },
                        {
                            content: [
                                {
                                    value: "\n",
                                    isInterpolated: false,
                                    loc: getLocByIndex(39, 40)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(39, 40),
                            prev: nodeList[0].children[1]
                        }
                    ],
                    loc: getLocByIndex(0, 45),
                    startTagEndPos: getPosByIndex(4),
                    endTagStartPos: getPosByIndex(40)
                }
            ]
        }, [
            {
                type: "error",
                range: [21, 24],
                value: "Invalid template structure: the <dt> tag can not be descendant of <dt>."
            }
        ])
    })

    test("Block element is descendant of paragraph element", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(
                formatSourceCode(`
                        <p>
                            <div></div>
                        </p>
                    `)
            )
            return [
                nodeList,
                {
                    tag: "p",
                    children: [
                        {
                            content: [
                                {
                                    value: "\n    ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(3, 8)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(3, 8),
                            next: nodeList[0].children[1]
                        },
                        {
                            content: [
                                {
                                    value: "\n",
                                    isInterpolated: false,
                                    loc: getLocByIndex(19, 20)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(19, 20),
                            prev: nodeList[0].children[0]
                        }
                    ],
                    loc: getLocByIndex(0, 24),
                    startTagEndPos: getPosByIndex(3),
                    endTagStartPos: getPosByIndex(20)
                }
            ]
        }, [
            {
                type: "error",
                range: [8, 12],
                value: "Invalid template structure: the <div> tag can not be descendant of <p>."
            }
        ])

        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(
                formatSourceCode(`
                        <div>
                            <p>
                                <span>
                                    <main></main>
                                </span>
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
                                    loc: getLocByIndex(5, 10)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(5, 10),
                            next: nodeList[0].children[1]
                        },
                        {
                            tag: "p",
                            children: [
                                {
                                    content: [
                                        {
                                            value: "\n        ",
                                            isInterpolated: false,
                                            loc: getLocByIndex(13, 22)
                                        }
                                    ],
                                    loc: getLocByIndex(13, 22),
                                    parent: nodeList[0].children[1],
                                    next: nodeList[0].children[1].children[1]
                                },
                                {
                                    tag: "span",
                                    children: [
                                        {
                                            content: [
                                                {
                                                    isInterpolated: false,
                                                    value: "\n            ",
                                                    loc: getLocByIndex(28, 41)
                                                }
                                            ],
                                            loc: getLocByIndex(28, 41),
                                            parent: nodeList[0].children[1].children[1],
                                            next: nodeList[0].children[1].children[1].children[1]
                                        },
                                        {
                                            content: [
                                                {
                                                    value: "\n        ",
                                                    isInterpolated: false,
                                                    loc: getLocByIndex(54, 63)
                                                }
                                            ],
                                            loc: getLocByIndex(54, 63),
                                            parent: nodeList[0].children[1].children[1],
                                            prev: nodeList[0].children[1].children[1].children[0]
                                        }
                                    ],
                                    loc: getLocByIndex(22, 70),
                                    parent: nodeList[0].children[1],
                                    startTagEndPos: getPosByIndex(28),
                                    endTagStartPos: getPosByIndex(63),
                                    prev: nodeList[0].children[1].children[0],
                                    next: nodeList[0].children[1].children[2]
                                },
                                {
                                    content: [
                                        {
                                            value: "\n    ",
                                            isInterpolated: false,
                                            loc: getLocByIndex(70, 75)
                                        }
                                    ],
                                    loc: getLocByIndex(70, 75),
                                    parent: nodeList[0].children[1],
                                    prev: nodeList[0].children[1].children[1]
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(10, 79),
                            prev: nodeList[0].children[0],
                            next: nodeList[0].children[2],
                            startTagEndPos: getPosByIndex(13),
                            endTagStartPos: getPosByIndex(75)
                        },
                        {
                            content: [
                                {
                                    value: "\n",
                                    isInterpolated: false,
                                    loc: getLocByIndex(79, 80)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(79, 80),
                            prev: nodeList[0].children[1]
                        }
                    ],
                    loc: getLocByIndex(0, 86),
                    startTagEndPos: getPosByIndex(5),
                    endTagStartPos: getPosByIndex(80)
                }
            ]
        }, [
            {
                type: "error",
                range: [41, 46],
                value: "Invalid template structure: the <main> tag can not be descendant of <p>."
            }
        ])
    })
})

it("Should not cause error when `dt` tag is used as descendant of `dl` of another `dt` element", () => {
    const nodeList = parseTemplateStandalone(
        formatSourceCode(`
                <dt>
                    <dl>
                        <dt></dt>
                    </dl>
                </dt>
            `),
        {
            recover: true,
            structureCheck: true
        }
    )
    matchTemplateNodeList(nodeList, {
        tag: "dt",
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
                tag: "dl",
                children: [
                    {
                        content: [
                            {
                                value: "\n        ",
                                isInterpolated: false,
                                loc: getLocByIndex(13, 22)
                            }
                        ],
                        loc: getLocByIndex(13, 22),
                        parent: nodeList[0].children[1],
                        next: nodeList[0].children[1].children[1]
                    },
                    {
                        tag: "dt",
                        loc: getLocByIndex(22, 31),
                        parent: nodeList[0].children[1],
                        startTagEndPos: getPosByIndex(26),
                        endTagStartPos: getPosByIndex(26),
                        prev: nodeList[0].children[1].children[0],
                        next: nodeList[0].children[1].children[2]
                    },
                    {
                        content: [
                            {
                                value: "\n    ",
                                isInterpolated: false,
                                loc: getLocByIndex(31, 36)
                            }
                        ],
                        loc: getLocByIndex(31, 36),
                        parent: nodeList[0].children[1],
                        prev: nodeList[0].children[1].children[1]
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(9, 41),
                prev: nodeList[0].children[0],
                next: nodeList[0].children[2],
                startTagEndPos: getPosByIndex(13),
                endTagStartPos: getPosByIndex(36)
            },
            {
                content: [
                    {
                        value: "\n",
                        isInterpolated: false,
                        loc: getLocByIndex(41, 42)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(41, 42),
                prev: nodeList[0].children[1]
            }
        ],
        loc: getLocByIndex(0, 47),
        startTagEndPos: getPosByIndex(4),
        endTagStartPos: getPosByIndex(42)
    })
})
