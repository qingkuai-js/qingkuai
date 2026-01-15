import { describe, test } from "vitest"
import {
    matchTemplateNodeList,
    matchTemplateNodeListAndMessages
} from "../../../src/util/testing/match"
import {
    getPosByIndex,
    getLocByIndex,
    getLocWithDefaultEnd
} from "../../../src/util/compiler/position"
import { parseTemplateStandalone } from "../../../src/compiler/parser/template"

test("Single tag", () => {
    matchTemplateNodeList(parseTemplateStandalone("<div></div>"), {
        tag: "div",
        loc: getLocByIndex(0, 11),
        startTagEndPos: getPosByIndex(5),
        endTagStartPos: getPosByIndex(5)
    })
})

test("Multiple tags", () => {
    const nodeList = parseTemplateStandalone("<p></p><span></span>")
    matchTemplateNodeList(
        nodeList,
        {
            tag: "p",
            next: nodeList[1],
            loc: getLocByIndex(0, 7),
            startTagEndPos: getPosByIndex(3),
            endTagStartPos: getPosByIndex(3)
        },
        {
            tag: "span",
            prev: nodeList[0],
            loc: getLocByIndex(7, 20),
            startTagEndPos: getPosByIndex(13),
            endTagStartPos: getPosByIndex(13)
        }
    )
})

test("Single comment", () => {
    matchTemplateNodeList(
        parseTemplateStandalone("<!---->", {
            reseveCommentNodes: true
        }),
        {
            tag: "!",
            loc: getLocByIndex(0, 7),
            startTagEndPos: getPosByIndex(4),
            endTagStartPos: getPosByIndex(4)
        }
    )
})

test("Multiple comments", () => {
    const nodeList = parseTemplateStandalone("a<!----><div></div><!---->c\n<!---->d", {
        reseveCommentNodes: true
    })
    matchTemplateNodeList(
        nodeList,
        {
            content: [
                {
                    value: "a",
                    isInterpolated: false,
                    loc: getLocByIndex(0, 1)
                }
            ],
            next: nodeList[1],
            loc: getLocByIndex(0, 1)
        },
        {
            tag: "!",
            prev: nodeList[0],
            next: nodeList[2],
            loc: getLocByIndex(1, 8),
            startTagEndPos: getPosByIndex(5),
            endTagStartPos: getPosByIndex(5)
        },
        {
            tag: "div",
            prev: nodeList[1],
            next: nodeList[3],
            loc: getLocByIndex(8, 19),
            startTagEndPos: getPosByIndex(13),
            endTagStartPos: getPosByIndex(13)
        },
        {
            tag: "!",
            prev: nodeList[2],
            next: nodeList[4],
            loc: getLocByIndex(19, 26),
            startTagEndPos: getPosByIndex(23),
            endTagStartPos: getPosByIndex(23)
        },
        {
            content: [
                {
                    value: "c\n",
                    isInterpolated: false,
                    loc: getLocByIndex(26, 28)
                }
            ],
            prev: nodeList[3],
            next: nodeList[5],
            loc: getLocByIndex(26, 28)
        },
        {
            tag: "!",
            prev: nodeList[4],
            next: nodeList[6],
            loc: getLocByIndex(28, 35),
            startTagEndPos: getPosByIndex(32),
            endTagStartPos: getPosByIndex(32)
        },
        {
            content: [
                {
                    value: "d",
                    isInterpolated: false,
                    loc: getLocByIndex(35, 36)
                }
            ],
            prev: nodeList[5],
            loc: getLocByIndex(35, 36)
        }
    )
})

test("Single self-closing tag", () => {
    matchTemplateNodeList(parseTemplateStandalone("<input>"), {
        tag: "input",
        isSelfClosing: true,
        loc: getLocByIndex(0, 7),
        startTagEndPos: getPosByIndex(7)
    })
})

test("Multiple self-closing tags", () => {
    const nodeList = parseTemplateStandalone("<input><br/> \n<img   />")
    matchTemplateNodeList(
        nodeList,
        {
            tag: "input",
            next: nodeList[1],
            isSelfClosing: true,
            loc: getLocByIndex(0, 7),
            startTagEndPos: getPosByIndex(7)
        },
        {
            tag: "br",
            prev: nodeList[0],
            next: nodeList[2],
            isSelfClosing: true,
            loc: getLocByIndex(7, 12),
            startTagEndPos: getPosByIndex(12)
        },
        {
            content: [
                {
                    value: " \n",
                    isInterpolated: false,
                    loc: getLocByIndex(12, 14)
                }
            ],
            prev: nodeList[1],
            next: nodeList[3],
            loc: getLocByIndex(12, 14)
        },
        {
            tag: "img",
            prev: nodeList[2],
            isSelfClosing: true,
            loc: getLocByIndex(14, 23),
            startTagEndPos: getPosByIndex(23)
        }
    )
})

test("Single text content", () => {
    matchTemplateNodeList(parseTemplateStandalone("..."), {
        content: [
            {
                value: "...",
                isInterpolated: false,
                loc: getLocByIndex(0, 3)
            }
        ],
        loc: getLocByIndex(0, 3)
    })
})

test("Mixed source of text contents and tags", () => {
    const nodeList = parseTemplateStandalone(" a\n<p></p>\n<span></span>d<!---->e", {
        reseveCommentNodes: true
    })
    matchTemplateNodeList(
        nodeList,
        {
            next: nodeList[1],
            content: [
                {
                    value: " a\n",
                    isInterpolated: false,
                    loc: getLocByIndex(0, 3)
                }
            ],
            loc: getLocByIndex(0, 3)
        },
        {
            tag: "p",
            prev: nodeList[0],
            next: nodeList[2],
            loc: getLocByIndex(3, 10),
            startTagEndPos: getPosByIndex(6),
            endTagStartPos: getPosByIndex(6)
        },
        {
            prev: nodeList[1],
            next: nodeList[3],
            content: [
                {
                    value: "\n",
                    isInterpolated: false,
                    loc: getLocByIndex(10, 11)
                }
            ],
            loc: getLocByIndex(10, 11)
        },
        {
            tag: "span",
            prev: nodeList[2],
            next: nodeList[4],
            loc: getLocByIndex(11, 24),
            startTagEndPos: getPosByIndex(17),
            endTagStartPos: getPosByIndex(17)
        },
        {
            content: [
                {
                    value: "d",
                    isInterpolated: false,
                    loc: getLocByIndex(24, 25)
                }
            ],
            prev: nodeList[3],
            next: nodeList[5],
            loc: getLocByIndex(24, 25)
        },
        {
            tag: "!",
            prev: nodeList[4],
            next: nodeList[6],
            loc: getLocByIndex(25, 32),
            startTagEndPos: getPosByIndex(29),
            endTagStartPos: getPosByIndex(29)
        },
        {
            content: [
                {
                    value: "e",
                    isInterpolated: false,
                    loc: getLocByIndex(32, 33)
                }
            ],
            prev: nodeList[5],
            loc: getLocByIndex(32, 33)
        }
    )
})

test("Single text content interpolation block", () => {
    matchTemplateNodeList(parseTemplateStandalone("{value}"), {
        content: [
            {
                value: "value",
                isInterpolated: true,
                loc: getLocByIndex(1, 6)
            }
        ],
        loc: getLocByIndex(0, 7)
    })
})

test("Multiple text content interpolation blocks", () => {
    matchTemplateNodeList(parseTemplateStandalone("1{2}3{4}"), {
        content: [
            {
                value: "1",
                isInterpolated: false,
                loc: getLocByIndex(0, 1)
            },
            {
                value: "2",
                isInterpolated: true,
                loc: getLocByIndex(2, 3)
            },
            {
                value: "3",
                isInterpolated: false,
                loc: getLocByIndex(4, 5)
            },
            {
                value: "4",
                isInterpolated: true,
                loc: getLocByIndex(6, 7)
            }
        ],
        loc: getLocByIndex(0, 8)
    })
})

test("Whehter invalid tag structure will be parsed as text content", () => {
    matchTemplateNodeList(parseTemplateStandalone(`<></>`), {
        content: [
            {
                value: "<></>",
                isInterpolated: false,
                loc: getLocByIndex(0, 5)
            }
        ],
        loc: getLocByIndex(0, 5)
    })

    matchTemplateNodeList(parseTemplateStandalone(`<0></0>`), {
        content: [
            {
                value: "<0></0>",
                isInterpolated: false,
                loc: getLocByIndex(0, 7)
            }
        ],
        loc: getLocByIndex(0, 7)
    })

    matchTemplateNodeList(parseTemplateStandalone(`<-a></-a>`), {
        content: [
            {
                value: "<-a></-a>",
                isInterpolated: false,
                loc: getLocByIndex(0, 9)
            }
        ],
        loc: getLocByIndex(0, 9)
    })
})

describe("Whether incorrect format for tag will cause parsing error", () => {
    test("Unexpected token inside tag name", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseTemplateStandalone(`<a=></a=>`, {
                    recover: true
                }),
                {
                    tag: "a",
                    loc: getLocByIndex(0, 9),
                    startTagEndPos: getPosByIndex(4),
                    endTagStartPos: getPosByIndex(4)
                }
            ],
            [
                {
                    type: "error",
                    range: [2, 3],
                    value: "Invalid format for attributes."
                },
                {
                    type: "error",
                    range: [7, 8],
                    value: "Unexpected token: =, expected: >."
                }
            ]
        )
    })

    test("Start tag is not closed", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseTemplateStandalone("<div", {
                    recover: true
                }),
                {
                    tag: "div",
                    loc: getLocWithDefaultEnd(0)
                }
            ],
            [
                {
                    type: "error",
                    range: [0, 4],
                    value: "The start tag <div> is not closed."
                }
            ]
        )

        matchTemplateNodeListAndMessages(
            () => [
                parseTemplateStandalone("<input", {
                    recover: true
                }),
                {
                    tag: "input",
                    isSelfClosing: true,
                    loc: getLocWithDefaultEnd(0)
                }
            ],
            [
                {
                    type: "error",
                    range: [0, 6],
                    value: "The start tag <input> is not closed."
                }
            ]
        )

        matchTemplateNodeListAndMessages(
            () => [
                parseTemplateStandalone("<!-- ...\n ...", {
                    recover: true,
                    reseveCommentNodes: true
                }),
                {
                    tag: "!",
                    content: [
                        {
                            value: " ...\n ...",
                            isInterpolated: false,
                            loc: getLocByIndex(4, 13)
                        }
                    ],
                    loc: getLocWithDefaultEnd(0),
                    startTagEndPos: getPosByIndex(4)
                }
            ],
            [
                {
                    type: "error",
                    range: [0, 4],
                    value: "The comment tag is not closed."
                }
            ]
        )
    })

    test("End tag is not closed", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseTemplateStandalone(`<a></a `, {
                    recover: true
                }),
                {
                    tag: "a",
                    loc: getLocWithDefaultEnd(0),
                    startTagEndPos: getPosByIndex(3),
                    endTagStartPos: getPosByIndex(3)
                }
            ],
            [
                {
                    type: "error",
                    range: [3, 6],
                    value: "The end tag </a> is not closed."
                }
            ]
        )
    })

    test("Redundant characters inside end tag", () => {
        matchTemplateNodeListAndMessages(() => {
            const nodeList = parseTemplateStandalone(`<p> </p bool class="test" >`, {
                recover: true
            })
            return [
                nodeList,
                {
                    tag: "p",
                    children: [
                        {
                            content: [
                                {
                                    value: " ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(3, 4)
                                }
                            ],
                            parent: nodeList[0],
                            loc: getLocByIndex(3, 4)
                        }
                    ],
                    loc: getLocByIndex(0, 27),
                    startTagEndPos: getPosByIndex(3),
                    endTagStartPos: getPosByIndex(4)
                }
            ]
        }, [
            {
                type: "error",
                range: [8, 9],
                value: "Unexpected token: b, expected: >."
            }
        ])
    })

    test("Self-closing syntax on non-void element", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseTemplateStandalone(`<div class="box" />`, {
                    recover: true
                }),
                {
                    tag: "div",
                    attributes: [
                        {
                            key: {
                                raw: "class",
                                loc: getLocByIndex(5, 10)
                            },
                            value: {
                                raw: "box",
                                loc: getLocByIndex(12, 15)
                            },
                            quote: "double",
                            loc: getLocByIndex(5, 16)
                        }
                    ],
                    loc: getLocWithDefaultEnd(0),
                    startTagEndPos: getPosByIndex(19)
                }
            ],
            [
                {
                    type: "error",
                    range: [17, 19],
                    value: "The <div> tag can not be used as self-closing tag."
                }
            ]
        )
    })

    test("Starts with an end tag", () => {
        matchTemplateNodeListAndMessages(
            () => [
                parseTemplateStandalone(`</div>`, {
                    recover: true
                })
            ],
            [
                {
                    type: "error",
                    range: [0, 5],
                    value: "Starts with an end tag: </div>."
                }
            ]
        )
    })
})
