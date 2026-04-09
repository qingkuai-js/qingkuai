import { describe, test } from "vitest"
import {
    getLocByIndex,
    getPosByIndex,
    getLocWithDefaultEnd
} from "../../../../src/util/compiler/position"
import { formatSourceCode } from "../../../../src/util/shared/sundry"
import { parseTemplateTesting } from "../../../../src/util/testing/sundry"
import { matchTemplateNodeList, matchTemplateNodeListAndMessages } from "./_match"

test("Single level", () => {
    const nodeList = parseTemplateTesting("\n \n<b>  bold  </b>\n")
    matchTemplateNodeList(
        nodeList,
        {
            next: nodeList[1],
            content: [
                {
                    value: "\n \n",
                    isInterpolated: false,
                    loc: getLocByIndex(0, 3)
                }
            ],
            loc: getLocByIndex(0, 3)
        },
        {
            tag: "b",
            prev: nodeList[0],
            next: nodeList[2],
            children: [
                {
                    parent: nodeList[1],
                    content: [
                        {
                            value: "  bold  ",
                            isInterpolated: false,
                            loc: getLocByIndex(6, 14)
                        }
                    ],
                    loc: getLocByIndex(6, 14)
                }
            ],
            loc: getLocByIndex(3, 18),
            startTagEndPos: getPosByIndex(6),
            endTagStartPos: getPosByIndex(14)
        },
        {
            prev: nodeList[1],
            content: [
                {
                    value: "\n",
                    isInterpolated: false,
                    loc: getLocByIndex(18, 19)
                }
            ],
            loc: getLocByIndex(18, 19)
        }
    )
})

test("Muti level", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
                ...
                <div>
                    <p>
                        <a>
                            go
                        </a>
                    </p>
                </div>
                ...
            `)
    )
    matchTemplateNodeList(
        nodeList,
        {
            next: nodeList[1],
            content: [
                {
                    value: "...\n",
                    isInterpolated: false,
                    loc: getLocByIndex(0, 4)
                }
            ],
            loc: getLocByIndex(0, 4)
        },
        {
            tag: "div",
            prev: nodeList[0],
            next: nodeList[2],
            children: [
                {
                    content: [
                        {
                            value: "\n    ",
                            isInterpolated: false,
                            loc: getLocByIndex(9, 14)
                        }
                    ],
                    parent: nodeList[1],
                    loc: getLocByIndex(9, 14),
                    next: nodeList[1].children[1]
                },
                {
                    tag: "p",
                    parent: nodeList[1],
                    prev: nodeList[1].children[0],
                    next: nodeList[1].children[2],
                    children: [
                        {
                            content: [
                                {
                                    value: "\n        ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(17, 26)
                                }
                            ],
                            loc: getLocByIndex(17, 26),
                            parent: nodeList[1].children[1],
                            next: nodeList[1].children[1].children[1]
                        },
                        {
                            tag: "a",
                            parent: nodeList[1].children[1],
                            prev: nodeList[1].children[1].children[0],
                            next: nodeList[1].children[1].children[2],
                            children: [
                                {
                                    content: [
                                        {
                                            isInterpolated: false,
                                            loc: getLocByIndex(29, 53),
                                            value: "\n            go\n        "
                                        }
                                    ],
                                    loc: getLocByIndex(29, 53),
                                    parent: nodeList[1].children[1].children[1]
                                }
                            ],
                            loc: getLocByIndex(26, 57),
                            startTagEndPos: getPosByIndex(29),
                            endTagStartPos: getPosByIndex(53)
                        },
                        {
                            content: [
                                {
                                    value: "\n    ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(57, 62)
                                }
                            ],
                            loc: getLocByIndex(57, 62),
                            parent: nodeList[1].children[1],
                            prev: nodeList[1].children[1].children[1]
                        }
                    ],
                    loc: getLocByIndex(14, 66),
                    startTagEndPos: getPosByIndex(17),
                    endTagStartPos: getPosByIndex(62)
                },
                {
                    content: [
                        {
                            value: "\n",
                            isInterpolated: false,
                            loc: getLocByIndex(66, 67)
                        }
                    ],
                    parent: nodeList[1],
                    loc: getLocByIndex(66, 67),
                    prev: nodeList[1].children[1]
                }
            ],
            loc: getLocByIndex(4, 73),
            startTagEndPos: getPosByIndex(9),
            endTagStartPos: getPosByIndex(67)
        },
        {
            content: [
                {
                    value: "\n...",
                    isInterpolated: false,
                    loc: getLocByIndex(73, 77)
                }
            ],
            prev: nodeList[1],
            loc: getLocByIndex(73, 77)
        }
    )
})

test("Identical tags", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
                <div>
                    <div></div>
                    <div></div>
                </div>
                <span><span></span></span>
            `)
    )
    matchTemplateNodeList(
        nodeList,
        {
            tag: "div",
            next: nodeList[1],
            children: [
                {
                    content: [
                        {
                            value: "\n    ",
                            isInterpolated: false,
                            loc: getLocByIndex(5, 10)
                        }
                    ],
                    loc: getLocByIndex(5, 10),
                    parent: nodeList[0],
                    next: nodeList[0].children[1]
                },
                {
                    tag: "div",
                    parent: nodeList[0],
                    loc: getLocByIndex(10, 21),
                    prev: nodeList[0].children[0],
                    next: nodeList[0].children[2],
                    startTagEndPos: getPosByIndex(15),
                    endTagStartPos: getPosByIndex(15)
                },
                {
                    content: [
                        {
                            value: "\n    ",
                            isInterpolated: false,
                            loc: getLocByIndex(21, 26)
                        }
                    ],
                    parent: nodeList[0],
                    loc: getLocByIndex(21, 26),
                    prev: nodeList[0].children[1],
                    next: nodeList[0].children[3]
                },
                {
                    tag: "div",
                    parent: nodeList[0],
                    loc: getLocByIndex(26, 37),
                    prev: nodeList[0].children[2],
                    next: nodeList[0].children[4],
                    startTagEndPos: getPosByIndex(31),
                    endTagStartPos: getPosByIndex(31)
                },
                {
                    content: [
                        {
                            value: "\n",
                            isInterpolated: false,
                            loc: getLocByIndex(37, 38)
                        }
                    ],
                    parent: nodeList[0],
                    loc: getLocByIndex(37, 38),
                    prev: nodeList[0].children[3]
                }
            ],
            loc: getLocByIndex(0, 44),
            startTagEndPos: getPosByIndex(5),
            endTagStartPos: getPosByIndex(38)
        },
        {
            content: [
                {
                    value: "\n",
                    isInterpolated: false,
                    loc: getLocByIndex(44, 45)
                }
            ],
            prev: nodeList[0],
            next: nodeList[2],
            loc: getLocByIndex(44, 45)
        },
        {
            tag: "span",
            prev: nodeList[1],
            children: [
                {
                    tag: "span",
                    parent: nodeList[2],
                    loc: getLocByIndex(51, 64),
                    startTagEndPos: getPosByIndex(57),
                    endTagStartPos: getPosByIndex(57)
                }
            ],
            loc: getLocByIndex(45, 71),
            startTagEndPos: getPosByIndex(51),
            endTagStartPos: getPosByIndex(64)
        }
    )
})

test("With comment", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <div>
                <!-- line comment -->
                name <!-- ... --> age
            </div>
        `),
        { preserveCommentNodes: true }
    )
    matchTemplateNodeList(nodeList, {
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
                tag: "!",
                children: [
                    {
                        content: [
                            {
                                value: " line comment ",
                                isInterpolated: false,
                                loc: getLocByIndex(14, 28)
                            }
                        ],
                        preWhiteSpace: true,
                        loc: getLocByIndex(14, 28),
                        parent: nodeList[0].children[1]
                    }
                ],
                parent: nodeList[0],
                preWhiteSpace: true,
                loc: getLocByIndex(10, 31),
                prev: nodeList[0].children[0],
                next: nodeList[0].children[2],
                startTagEndPos: getPosByIndex(14),
                endTagStartPos: getPosByIndex(28)
            },
            {
                content: [
                    {
                        value: "\n    name ",
                        isInterpolated: false,
                        loc: getLocByIndex(31, 41)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(31, 41),
                prev: nodeList[0].children[1],
                next: nodeList[0].children[3]
            },
            {
                tag: "!",
                children: [
                    {
                        content: [
                            {
                                value: " ... ",
                                isInterpolated: false,
                                loc: getLocByIndex(45, 50)
                            }
                        ],
                        preWhiteSpace: true,
                        loc: getLocByIndex(45, 50),
                        parent: nodeList[0].children[3]
                    }
                ],
                parent: nodeList[0],
                preWhiteSpace: true,
                loc: getLocByIndex(41, 53),
                prev: nodeList[0].children[2],
                next: nodeList[0].children[4],
                startTagEndPos: getPosByIndex(45),
                endTagStartPos: getPosByIndex(50)
            },
            {
                content: [
                    {
                        value: " age\n",
                        isInterpolated: false,
                        loc: getLocByIndex(53, 58)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(53, 58),
                prev: nodeList[0].children[3]
            }
        ],
        loc: getLocByIndex(0, 64),
        startTagEndPos: getPosByIndex(5),
        endTagStartPos: getPosByIndex(58)
    })
})

test("With self-closing tags", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <div>
                <input>
                <br/>
                <div>
                    <img />
                </div>
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
                        loc: getLocByIndex(5, 10)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(5, 10),
                next: nodeList[0].children[1]
            },
            {
                tag: "input",
                isSelfClosing: true,
                parent: nodeList[0],
                loc: getLocByIndex(10, 17),
                prev: nodeList[0].children[0],
                next: nodeList[0].children[2],
                startTagEndPos: getPosByIndex(17)
            },
            {
                content: [
                    {
                        value: "\n    ",
                        isInterpolated: false,
                        loc: getLocByIndex(17, 22)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(17, 22),
                prev: nodeList[0].children[1],
                next: nodeList[0].children[3]
            },
            {
                tag: "br",
                isSelfClosing: true,
                parent: nodeList[0],
                loc: getLocByIndex(22, 27),
                prev: nodeList[0].children[2],
                next: nodeList[0].children[4],
                startTagEndPos: getPosByIndex(27)
            },
            {
                content: [
                    {
                        value: "\n    ",
                        isInterpolated: false,
                        loc: getLocByIndex(27, 32)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(27, 32),
                prev: nodeList[0].children[3],
                next: nodeList[0].children[5]
            },
            {
                tag: "div",
                children: [
                    {
                        content: [
                            {
                                value: "\n        ",
                                isInterpolated: false,
                                loc: getLocByIndex(37, 46)
                            }
                        ],
                        loc: getLocByIndex(37, 46),
                        parent: nodeList[0].children[5],
                        next: nodeList[0].children[5].children[1]
                    },
                    {
                        tag: "img",
                        isSelfClosing: true,
                        loc: getLocByIndex(46, 53),
                        parent: nodeList[0].children[5],
                        startTagEndPos: getPosByIndex(53),
                        prev: nodeList[0].children[5].children[0],
                        next: nodeList[0].children[5].children[2]
                    },
                    {
                        content: [
                            {
                                value: "\n    ",
                                isInterpolated: false,
                                loc: getLocByIndex(53, 58)
                            }
                        ],
                        loc: getLocByIndex(53, 58),
                        parent: nodeList[0].children[5],
                        prev: nodeList[0].children[5].children[1]
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(32, 64),
                prev: nodeList[0].children[4],
                next: nodeList[0].children[6],
                startTagEndPos: getPosByIndex(37),
                endTagStartPos: getPosByIndex(58)
            },
            {
                content: [
                    {
                        value: "\n",
                        isInterpolated: false,
                        loc: getLocByIndex(64, 65)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(64, 65),
                prev: nodeList[0].children[5]
            }
        ],
        loc: getLocByIndex(0, 71),
        startTagEndPos: getPosByIndex(5),
        endTagStartPos: getPosByIndex(65)
    })
})

test("With components", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <my-comp>
                <Test/>
                <The-comp />
                <div> ... </div>
            </my-comp>
        `)
    )
    matchTemplateNodeList(nodeList, {
        tag: "my-comp",
        children: [
            {
                content: [
                    {
                        value: "\n    ",
                        isInterpolated: false,
                        loc: getLocByIndex(9, 14)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(9, 14),
                next: nodeList[0].children[1]
            },
            {
                tag: "Test",
                parent: nodeList[0],
                isSelfClosing: true,
                componentTag: "Test",
                loc: getLocByIndex(14, 21),
                prev: nodeList[0].children[0],
                next: nodeList[0].children[2],
                startTagEndPos: getPosByIndex(21)
            },
            {
                content: [
                    {
                        value: "\n    ",
                        isInterpolated: false,
                        loc: getLocByIndex(21, 26)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(21, 26),
                prev: nodeList[0].children[1],
                next: nodeList[0].children[3]
            },
            {
                tag: "The-comp",
                parent: nodeList[0],
                isSelfClosing: true,
                componentTag: "TheComp",
                loc: getLocByIndex(26, 38),
                prev: nodeList[0].children[2],
                next: nodeList[0].children[4],
                startTagEndPos: getPosByIndex(38)
            },
            {
                content: [
                    {
                        value: "\n    ",
                        isInterpolated: false,
                        loc: getLocByIndex(38, 43)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(38, 43),
                prev: nodeList[0].children[3],
                next: nodeList[0].children[5]
            },
            {
                tag: "div",
                children: [
                    {
                        content: [
                            {
                                value: " ... ",
                                isInterpolated: false,
                                loc: getLocByIndex(48, 53)
                            }
                        ],
                        loc: getLocByIndex(48, 53),
                        parent: nodeList[0].children[5]
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(43, 59),
                prev: nodeList[0].children[4],
                next: nodeList[0].children[6],
                startTagEndPos: getPosByIndex(48),
                endTagStartPos: getPosByIndex(53)
            },
            {
                content: [
                    {
                        value: "\n",
                        isInterpolated: false,
                        loc: getLocByIndex(59, 60)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(59, 60),
                prev: nodeList[0].children[5]
            }
        ],
        componentTag: "myComp",
        loc: getLocByIndex(0, 70),
        startTagEndPos: getPosByIndex(9),
        endTagStartPos: getPosByIndex(60)
    })
})

test("With a text content interpolation block", () => {
    const nodeList = parseTemplateTesting("<div>{value}</div>")
    matchTemplateNodeList(nodeList, {
        tag: "div",
        children: [
            {
                content: [
                    {
                        value: "value",
                        isInterpolated: true,
                        loc: getLocByIndex(6, 11)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(5, 12)
            }
        ],
        loc: getLocByIndex(0, 18),
        startTagEndPos: getPosByIndex(5),
        endTagStartPos: getPosByIndex(12)
    })
})

test("With multiple text content interpolation blocks", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
                <p>
                    name:
                    <span> {name} </span>
                </p>
                <p>
                    infos:
                    <span> {age}, {gender}</span>
                </p>
            `)
    )
    matchTemplateNodeList(
        nodeList,
        {
            tag: "p",
            children: [
                {
                    content: [
                        {
                            isInterpolated: false,
                            value: "\n    name:\n    ",
                            loc: getLocByIndex(3, 18)
                        }
                    ],
                    parent: nodeList[0],
                    loc: getLocByIndex(3, 18),
                    next: nodeList[0].children[1]
                },
                {
                    tag: "span",
                    children: [
                        {
                            content: [
                                {
                                    value: " ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(24, 25)
                                },
                                {
                                    value: "name",
                                    isInterpolated: true,
                                    loc: getLocByIndex(26, 30)
                                },
                                {
                                    value: " ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(31, 32)
                                }
                            ],
                            loc: getLocByIndex(24, 32),
                            parent: nodeList[0].children[1]
                        }
                    ],
                    parent: nodeList[0],
                    loc: getLocByIndex(18, 39),
                    prev: nodeList[0].children[0],
                    next: nodeList[0].children[2],
                    startTagEndPos: getPosByIndex(24),
                    endTagStartPos: getPosByIndex(32)
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
            next: nodeList[1],
            loc: getLocByIndex(0, 44),
            startTagEndPos: getPosByIndex(3),
            endTagStartPos: getPosByIndex(40)
        },
        {
            content: [
                {
                    value: "\n",
                    isInterpolated: false,
                    loc: getLocByIndex(44, 45)
                }
            ],
            prev: nodeList[0],
            next: nodeList[2],
            loc: getLocByIndex(44, 45)
        },
        {
            tag: "p",
            children: [
                {
                    content: [
                        {
                            isInterpolated: false,
                            loc: getLocByIndex(48, 64),
                            value: "\n    infos:\n    "
                        }
                    ],
                    parent: nodeList[2],
                    loc: getLocByIndex(48, 64),
                    next: nodeList[2].children[1]
                },
                {
                    tag: "span",
                    children: [
                        {
                            content: [
                                {
                                    value: " ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(70, 71)
                                },
                                {
                                    value: "age",
                                    isInterpolated: true,
                                    loc: getLocByIndex(72, 75)
                                },
                                {
                                    value: ", ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(76, 78)
                                },
                                {
                                    value: "gender",
                                    isInterpolated: true,
                                    loc: getLocByIndex(79, 85)
                                }
                            ],
                            loc: getLocByIndex(70, 86),
                            parent: nodeList[2].children[1]
                        }
                    ],
                    parent: nodeList[2],
                    loc: getLocByIndex(64, 93),
                    prev: nodeList[2].children[0],
                    next: nodeList[2].children[2],
                    startTagEndPos: getPosByIndex(70),
                    endTagStartPos: getPosByIndex(86)
                },
                {
                    content: [
                        {
                            value: "\n",
                            isInterpolated: false,
                            loc: getLocByIndex(93, 94)
                        }
                    ],
                    parent: nodeList[2],
                    loc: getLocByIndex(93, 94),
                    prev: nodeList[2].children[1]
                }
            ],
            prev: nodeList[1],
            loc: getLocByIndex(45, 98),
            startTagEndPos: getPosByIndex(48),
            endTagStartPos: getPosByIndex(94)
        }
    )
})

test("Type arguments for components", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <div>
                <Comp<Array<Item>>/>
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
                        loc: getLocByIndex(5, 10)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(5, 10),
                next: nodeList[0].children[1]
            },
            {
                tag: "Comp",
                parent: nodeList[0],
                isSelfClosing: true,
                componentTag: "Comp",
                typeArgument: {
                    raw: "Array<Item>",
                    loc: getLocByIndex(16, 27)
                },
                prev: nodeList[0].children[0],
                next: nodeList[0].children[2],
                loc: getLocByIndex(10, 30),
                startTagEndPos: getPosByIndex(30)
            },
            {
                content: [
                    {
                        value: "\n",
                        isInterpolated: false,
                        loc: getLocByIndex(30, 31)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(30, 31),
                prev: nodeList[0].children[1]
            }
        ],
        loc: getLocByIndex(0, 37),
        startTagEndPos: getPosByIndex(5),
        endTagStartPos: getPosByIndex(31)
    })
})

test("Whether the child elemnts of textarea are parsed as textContent", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <textarea>
                <p></p>
                <div></div>
            </textarea>
        `)
    )
    matchTemplateNodeList(nodeList, {
        tag: "textarea",
        children: [
            {
                content: [
                    {
                        isInterpolated: false,
                        loc: getLocByIndex(10, 39),
                        value: "\n    <p></p>\n    <div></div>\n"
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(10, 39)
            }
        ],
        loc: getLocByIndex(0, 50),
        startTagEndPos: getPosByIndex(10),
        endTagStartPos: getPosByIndex(39)
    })
})

test("Whehter invalid tag structure will be parsed as text content", () => {
    let nodeList = parseTemplateTesting(`<div><></></div>`)
    matchTemplateNodeList(nodeList, {
        tag: "div",
        children: [
            {
                content: [
                    {
                        value: "<></>",
                        isInterpolated: false,
                        loc: getLocByIndex(5, 10)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(5, 10)
            }
        ],
        loc: getLocByIndex(0, 16),
        startTagEndPos: getPosByIndex(5),
        endTagStartPos: getPosByIndex(10)
    })

    nodeList = parseTemplateTesting(`<p> <0></0> </p>`)
    matchTemplateNodeList(nodeList, {
        tag: "p",
        children: [
            {
                content: [
                    {
                        value: " <0></0> ",
                        isInterpolated: false,
                        loc: getLocByIndex(3, 12)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(3, 12)
            }
        ],
        loc: getLocByIndex(0, 16),
        startTagEndPos: getPosByIndex(3),
        endTagStartPos: getPosByIndex(12)
    })

    nodeList = parseTemplateTesting(
        formatSourceCode(`
            <Test>
                <-a> </-a>
            </Test>
        `)
    )
    matchTemplateNodeList(nodeList, {
        tag: "Test",
        children: [
            {
                content: [
                    {
                        isInterpolated: false,
                        value: "\n    <-a> </-a>\n",
                        loc: getLocByIndex(6, 22)
                    }
                ],
                parent: nodeList[0],
                loc: getLocByIndex(6, 22)
            }
        ],
        componentTag: "Test",
        loc: getLocByIndex(0, 29),
        startTagEndPos: getPosByIndex(6),
        endTagStartPos: getPosByIndex(22)
    })
})

describe("Whether incorrect format for tag will cause parsing error", () => {
    test("Unexpected token inside tag name", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseTemplateTesting(
                formatSourceCode(`
                    <my-comp>
                        <a=1></a=1>
                    </my-comp>
                `),
                { recover: true }
            )
            return [
                nodeList,
                {
                    tag: "my-comp",
                    children: [
                        {
                            content: [
                                {
                                    value: "\n    ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(9, 14)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(9, 14),
                            next: nodeList[0].children[1]
                        },
                        {
                            tag: "a",
                            parent: nodeList[0],
                            loc: getLocByIndex(14, 25),
                            prev: nodeList[0].children[0],
                            next: nodeList[0].children[2],
                            startTagEndPos: getPosByIndex(19),
                            endTagStartPos: getPosByIndex(19)
                        },
                        {
                            content: [
                                {
                                    value: "\n",
                                    isInterpolated: false,
                                    loc: getLocByIndex(25, 26)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(25, 26),
                            prev: nodeList[0].children[1]
                        }
                    ],
                    componentTag: "myComp",
                    loc: getLocByIndex(0, 36),
                    startTagEndPos: getPosByIndex(9),
                    endTagStartPos: getPosByIndex(26)
                }
            ]
        }, [
            {
                type: "error",
                range: [16, 18],
                value: "Invalid format for attributes."
            },
            {
                type: "error",
                range: [22, 23],
                value: "Unexpected token: =, expected: >."
            }
        ])
    })

    test("Start tag is not closed", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseTemplateTesting(`<p><a </p>`, {
                recover: true
            })
            return [
                nodeList,
                {
                    tag: "p",
                    children: [
                        {
                            tag: "a",
                            parent: nodeList[0],
                            loc: getLocWithDefaultEnd(3),
                            startTagEndPos: getPosByIndex(10)
                        }
                    ],
                    loc: getLocWithDefaultEnd(0),
                    startTagEndPos: getPosByIndex(3)
                }
            ]
        }, [
            {
                type: "error",
                range: [6, 9],
                value: "Invalid format for attributes."
            },
            {
                type: "error",
                range: [3, 5],
                value: "The <a> tag does not have a matched end tag: </a>."
            },
            {
                type: "error",
                range: [0, 2],
                value: "The <p> tag does not have a matched end tag: </p>."
            }
        ])

        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseTemplateTesting(`<Comp><!-- </Comp>`, {
                recover: true,
                preserveCommentNodes: true
            })
            return [
                nodeList,
                {
                    tag: "Comp",
                    children: [
                        {
                            tag: "!",
                            children: [
                                {
                                    content: [
                                        {
                                            value: " </Comp>",
                                            isInterpolated: false,
                                            loc: getLocByIndex(10, 18)
                                        }
                                    ],
                                    preWhiteSpace: true,
                                    loc: getLocByIndex(10, 18),
                                    parent: nodeList[0].children[0]
                                }
                            ],
                            parent: nodeList[0],
                            preWhiteSpace: true,
                            loc: getLocWithDefaultEnd(6),
                            startTagEndPos: getPosByIndex(10)
                        }
                    ],
                    componentTag: "Comp",
                    loc: getLocWithDefaultEnd(0),
                    startTagEndPos: getPosByIndex(6)
                }
            ]
        }, [
            {
                type: "error",
                range: [6, 10],
                value: "The comment tag is not closed."
            },
            {
                type: "error",
                range: [0, 5],
                value: "The <Comp> tag does not have a matched end tag: </Comp>."
            }
        ])
    })

    test("End tag is not closed", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseTemplateTesting(
                formatSourceCode(`
                    <my-comp>
                        <Test>
                            ...
                        </Test
                    </my-comp>
                `),
                { recover: true }
            )
            return [
                nodeList,
                {
                    tag: "my-comp",
                    children: [
                        {
                            content: [
                                {
                                    value: "\n    ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(9, 14)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(9, 14),
                            next: nodeList[0].children[1]
                        },
                        {
                            tag: "Test",
                            children: [
                                {
                                    content: [
                                        {
                                            isInterpolated: false,
                                            value: "\n        ...\n    ",
                                            loc: getLocByIndex(20, 37)
                                        }
                                    ],
                                    loc: getLocByIndex(20, 37),
                                    parent: nodeList[0].children[1]
                                }
                            ],
                            parent: nodeList[0],
                            componentTag: "Test",
                            loc: getLocByIndex(14, 54),
                            prev: nodeList[0].children[0],
                            startTagEndPos: getPosByIndex(20),
                            endTagStartPos: getPosByIndex(37)
                        }
                    ],
                    componentTag: "myComp",
                    loc: getLocWithDefaultEnd(0),
                    startTagEndPos: getPosByIndex(9)
                }
            ]
        }, [
            {
                type: "error",
                range: [44, 45],
                value: "Unexpected token: <, expected: >."
            },
            {
                type: "error",
                range: [0, 8],
                value: "The <my-comp> tag does not have a matched end tag: </my-comp>."
            }
        ])
    })

    test("Redundant characters inside end tag", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseTemplateTesting(
                formatSourceCode(`
                    <div>
                        <p></p bool >
                    </div>
                `),
                { recover: true }
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
                            parent: nodeList[0],
                            loc: getLocByIndex(10, 23),
                            prev: nodeList[0].children[0],
                            next: nodeList[0].children[2],
                            startTagEndPos: getPosByIndex(13),
                            endTagStartPos: getPosByIndex(13)
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
                            prev: nodeList[0].children[1]
                        }
                    ],
                    loc: getLocByIndex(0, 30),
                    startTagEndPos: getPosByIndex(5),
                    endTagStartPos: getPosByIndex(24)
                }
            ]
        }, [
            {
                type: "error",
                range: [17, 18],
                value: "Unexpected token: b, expected: >."
            }
        ])
    })

    test("Self-closing syntax on non-void element", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseTemplateTesting(`<div> <p/> </div>`, {
                recover: true
            })
            return [
                nodeList,
                {
                    tag: "div",
                    children: [
                        {
                            content: [
                                {
                                    value: " ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(5, 6)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(5, 6),
                            next: nodeList[0].children[1]
                        },
                        {
                            tag: "p",
                            parent: nodeList[0],
                            loc: getLocWithDefaultEnd(6),
                            prev: nodeList[0].children[0],
                            next: nodeList[0].children[2],
                            startTagEndPos: getPosByIndex(10)
                        },
                        {
                            content: [
                                {
                                    value: " ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(10, 11)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(10, 11),
                            prev: nodeList[0].children[1]
                        }
                    ],
                    loc: getLocByIndex(0, 17),
                    startTagEndPos: getPosByIndex(5),
                    endTagStartPos: getPosByIndex(11)
                }
            ]
        }, [
            {
                type: "error",
                range: [8, 10],
                value: "The <p> tag cannot be used as self-closing tag."
            }
        ])
    })

    test("Starts with an end tag", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseTemplateTesting(`<div></Comp></div>`, {
                recover: true
            })
            return [
                nodeList,
                {
                    tag: "div",
                    loc: getLocByIndex(0, 18),
                    startTagEndPos: getPosByIndex(5),
                    endTagStartPos: getPosByIndex(12)
                }
            ]
        }, [
            {
                type: "error",
                range: [5, 11],
                value: "Starts with an end tag: </Comp>."
            }
        ])
    })
})
