import { describe, it, test } from "vitest"
import { formatSourceCode } from "../../../../src/util/shared/sundry"
import { parseTemplateTesting } from "../../../../src/util/testing/sundry"
import { matchTemplateNodeList, matchTemplateNodeListAndMessages } from "./_match"
import { getLocByIndex, getPosByIndex } from "../../../../src/util/compiler/position"

test("Whether comment nodes were removed from parse result", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <!-- xxx -->
            <div class="container">
                <!-- text content -->
            </div>
        `),
        { preserveCommentNodes: false }
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
                    name: {
                        raw: "class",
                        loc: getLocByIndex(18, 23)
                    },
                    value: {
                        raw: "container",
                        loc: getLocByIndex(25, 34)
                    },
                    equalSign: true,
                    valueEnclosure: "double",
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
                    hasActualAncestor: true,
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
                    hasActualAncestor: true,
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
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <!--[if lte IE 8]>
                This will be displayed in IE8 or lower
            <![endif]-->
            <!--[if !IE]> -->
                This will be displayed in non-IE browsers
            <!-- <![endif]-->
        `),
        { preserveCommentNodes: false }
    )
    matchTemplateNodeList(
        nodeList,
        {
            tag: "!",
            children: [
                {
                    content: [
                        {
                            isInterpolated: false,
                            loc: getLocByIndex(4, 71),
                            value: "[if lte IE 8]>\n    This will be displayed in IE8 or lower\n<![endif]"
                        }
                    ],
                    parent: nodeList[0],
                    preWhiteSpace: true,
                    loc: getLocByIndex(4, 71)
                }
            ],
            next: nodeList[1],
            preWhiteSpace: true,
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
            children: [
                {
                    content: [
                        {
                            value: "[if !IE]> ",
                            isInterpolated: false,
                            loc: getLocByIndex(79, 89)
                        }
                    ],
                    parent: nodeList[2],
                    preWhiteSpace: true,
                    loc: getLocByIndex(79, 89)
                }
            ],
            prev: nodeList[1],
            next: nodeList[3],
            preWhiteSpace: true,
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
            children: [
                {
                    content: [
                        {
                            value: " <![endif]",
                            isInterpolated: false,
                            loc: getLocByIndex(143, 153)
                        }
                    ],
                    parent: nodeList[4],
                    preWhiteSpace: true,
                    loc: getLocByIndex(143, 153)
                }
            ],
            prev: nodeList[3],
            preWhiteSpace: true,
            loc: getLocByIndex(139, 156),
            startTagEndPos: getPosByIndex(143),
            endTagStartPos: getPosByIndex(153)
        }
    )
})

describe("Whether invalid template structure will cause parsing error", () => {
    const parseAndCheckStructure = (source: string) => {
        return parseTemplateTesting(source, {
            recover: true,
            checkTemplateStructure: true
        })
    }

    test("Disallowed tag is used", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseTemplateTesting(`<html> <frameset></frameset> </html>`, {
                    recover: true
                })
            ],
            [
                {
                    type: "error",
                    range: [0, 5],
                    value: "The <html> tag cannot be used in components file, as it cannot be embedded inside <body>, however you can define it in the entry HTML file."
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
                            hasActualAncestor: true,
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
                            hasActualAncestor: true,
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
                value: "Invalid template structure: the <div> tag cannot be nested in <table>."
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
                            hasActualAncestor: true,
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
                                    hasActualAncestor: true,
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
                                            hasActualAncestor: true,
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
                                            hasActualAncestor: true,
                                            loc: getLocByIndex(57, 66),
                                            parent: nodeList[0].children[1].children[1],
                                            prev: nodeList[0].children[1].children[1].children[0]
                                        }
                                    ],
                                    hasActualAncestor: true,
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
                                    hasActualAncestor: true,
                                    loc: getLocByIndex(71, 76),
                                    parent: nodeList[0].children[1],
                                    prev: nodeList[0].children[1].children[1]
                                }
                            ],
                            parent: nodeList[0],
                            hasActualAncestor: true,
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
                            hasActualAncestor: true,
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
                value: "Invalid template structure: the <p> tag cannot be nested in <tr>."
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
                            hasActualAncestor: true,
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
                            hasActualAncestor: true,
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
                value: "Invalid template structure: the <tr> tag cannot be nested in <div>, it can only be nested in these tags: <thead>, <tbody> or <tfoot>."
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
                    value: "Invalid template structure: the <li> tag cannot be nested in <li>."
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
                            hasActualAncestor: true,
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
                value: "Invalid template structure: the <a> tag cannot be descendant of <a>."
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
                            hasActualAncestor: true,
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
                                    hasActualAncestor: true,
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
                                    hasActualAncestor: true,
                                    loc: getLocByIndex(30, 35),
                                    parent: nodeList[0].children[1],
                                    prev: nodeList[0].children[1].children[0]
                                }
                            ],
                            parent: nodeList[0],
                            hasActualAncestor: true,
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
                            hasActualAncestor: true,
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
                value: "Invalid template structure: the <dt> tag cannot be descendant of <dt>."
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
                            hasActualAncestor: true,
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
                            hasActualAncestor: true,
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
                value: "Invalid template structure: the <div> tag cannot be descendant of <p>."
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
                            hasActualAncestor: true,
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
                                    hasActualAncestor: true,
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
                                            hasActualAncestor: true,
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
                                            hasActualAncestor: true,
                                            loc: getLocByIndex(54, 63),
                                            parent: nodeList[0].children[1].children[1],
                                            prev: nodeList[0].children[1].children[1].children[0]
                                        }
                                    ],
                                    hasActualAncestor: true,
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
                                    hasActualAncestor: true,
                                    loc: getLocByIndex(70, 75),
                                    parent: nodeList[0].children[1],
                                    prev: nodeList[0].children[1].children[1]
                                }
                            ],
                            parent: nodeList[0],
                            hasActualAncestor: true,
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
                            hasActualAncestor: true,
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
                value: "Invalid template structure: the <main> tag cannot be descendant of <p>."
            }
        ])
    })
})

it("Should not cause error when `dt` tag is used as descendant of `dl` of another `dt` element", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
                <dt>
                    <dl>
                        <dt></dt>
                    </dl>
                </dt>
            `),
        {
            recover: true,
            checkTemplateStructure: true
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
                hasActualAncestor: true,
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
                        hasActualAncestor: true,
                        loc: getLocByIndex(13, 22),
                        parent: nodeList[0].children[1],
                        next: nodeList[0].children[1].children[1]
                    },
                    {
                        tag: "dt",
                        hasActualAncestor: true,
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
                        hasActualAncestor: true,
                        loc: getLocByIndex(31, 36),
                        parent: nodeList[0].children[1],
                        prev: nodeList[0].children[1].children[1]
                    }
                ],
                parent: nodeList[0],
                hasActualAncestor: true,
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
                hasActualAncestor: true,
                loc: getLocByIndex(41, 42),
                prev: nodeList[0].children[1]
            }
        ],
        loc: getLocByIndex(0, 47),
        startTagEndPos: getPosByIndex(4),
        endTagStartPos: getPosByIndex(42)
    })
})

describe("Blank text filtering behavior", () => {
    test("Whitespace-only text nodes should be removed when preserveBlankTextNodes is false", () => {
        const nodeList = parseTemplateTesting(`<div>  </div>`, {
            preserveBlankTextNodes: false
        })

        matchTemplateNodeList(nodeList, {
            tag: "div",
            loc: getLocByIndex(0, 13),
            startTagEndPos: getPosByIndex(5),
            endTagStartPos: getPosByIndex(7)
        })
    })

    test("Non-blank text nodes should be preserved when preserveBlankTextNodes is false", () => {
        const nodeList = parseTemplateTesting(`<div>content</div>`, {
            preserveBlankTextNodes: false
        })

        matchTemplateNodeList(nodeList, {
            tag: "div",
            children: [
                {
                    content: [
                        {
                            value: "content",
                            isInterpolated: false,
                            loc: getLocByIndex(5, 12)
                        }
                    ],
                    parent: nodeList[0],
                    hasActualAncestor: true,
                    loc: getLocByIndex(5, 12)
                }
            ],
            loc: getLocByIndex(0, 18),
            startTagEndPos: getPosByIndex(5),
            endTagStartPos: getPosByIndex(12)
        })
    })
})

describe("Additional structure branches", () => {
    const parseAndCheckStructure = (source: string) => {
        return parseTemplateTesting(source, {
            recover: true,
            checkTemplateStructure: true
        })
    }

    test("Unexpected child for option and optgroup", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(`<select><option><div></div></option></select>`)
            return [nodeList, nodeList[0]]
        }, [
            {
                type: "error",
                range: [16, 20],
                value: "Invalid template structure: the <div> tag cannot be nested in <option>."
            }
        ])

        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(
                `<select><optgroup><div></div></optgroup></select>`
            )
            return [nodeList, nodeList[0]]
        }, [
            {
                type: "error",
                range: [18, 22],
                value: "Invalid template structure: the <div> tag cannot be nested in <optgroup>."
            }
        ])
    })

    test("Unexpected child for colgroup", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(
                `<table><colgroup><div></div></colgroup></table>`
            )
            return [nodeList, nodeList[0]]
        }, [
            {
                type: "error",
                range: [17, 21],
                value: "Invalid template structure: the <div> tag cannot be nested in <colgroup>."
            }
        ])
    })

    test("Nested td tags are invalid", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(
                `<table><tbody><tr><td><td></td></td></tr></tbody></table>`
            )
            return [nodeList, nodeList[0]]
        }, [
            {
                type: "error",
                range: [22, 25],
                value: "Invalid template structure: the <td> tag cannot be nested in <td>, it can only be nested in <tr>."
            }
        ])
    })

    test("Heading and ruby related ancestor rules", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(`<h1><h2></h2></h1>`)
            return [nodeList, nodeList[0]]
        }, [
            {
                type: "error",
                range: [4, 7],
                value: "Invalid template structure: the <h2> tag cannot be descendant of <h1>."
            }
        ])

        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseAndCheckStructure(`<ruby><rt><rp></rp></rt></ruby>`)
            return [nodeList, nodeList[0]]
        }, [
            {
                type: "error",
                range: [10, 13],
                value: "Invalid template structure: the <rp> tag cannot be descendant of <rt>."
            }
        ])
    })
})
