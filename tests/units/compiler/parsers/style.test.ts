import { describe, test } from "vitest"
import { matchTemplateNodeList } from "./_match"
import { formatSourceCode } from "../../../../src/util/shared/sundry"
import { parseTemplateTesting } from "../../../../src/util/testing/sundry"
import { getLocByIndex, getPosByIndex } from "../../../../src/util/compiler/position"

describe("Top level", () => {
    test("Whether the preWhiteSpace property for pre element is true", () => {
        matchTemplateNodeList(parseTemplateTesting("<pre></pre>"), {
            tag: "pre",
            preWhiteSpace: true,
            loc: getLocByIndex(0, 11),
            startTagEndPos: getPosByIndex(5),
            endTagStartPos: getPosByIndex(5)
        })
    })

    test("Modify the display property of the element to be pre related through comments", () => {
        const nodeList = parseTemplateTesting(
            formatSourceCode(`
                <!-- white-space: pre -->
                <div></div>
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
                        loc: getLocByIndex(25, 26)
                    }
                ],
                next: nodeList[1],
                loc: getLocByIndex(25, 26)
            },
            {
                tag: "div",
                prev: nodeList[0],
                preWhiteSpace: true,
                loc: getLocByIndex(26, 37),
                startTagEndPos: getPosByIndex(31),
                endTagStartPos: getPosByIndex(31)
            }
        )
    })

    test("Modify the display property of the element to be pre related through style attribute", () => {
        matchTemplateNodeList(
            parseTemplateTesting(
                formatSourceCode(`
                    <div
                        style="box-sizing:border-box;white-space:pre-line;"
                    ></div>
                `)
            ),
            {
                tag: "div",
                attributes: [
                    {
                        name: {
                            raw: "style",
                            loc: getLocByIndex(9, 14)
                        },
                        value: {
                            loc: getLocByIndex(16, 59),
                            raw: "box-sizing:border-box;white-space:pre-line;"
                        },
                        equalSign: true,
                        valueEnclosure: "double",
                        loc: getLocByIndex(9, 60)
                    }
                ],
                preWhiteSpace: true,
                loc: getLocByIndex(0, 68),
                startTagEndPos: getPosByIndex(62),
                endTagStartPos: getPosByIndex(62)
            }
        )
    })
})

describe("Nesting structure", () => {
    test("Whether the preWhiteSpace property for pre element is true", () => {
        const nodeList = parseTemplateTesting(
            formatSourceCode(`
                <div>
                    <pre>
                        <span>
                            ...
                        </span>
                    </pre>
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
                    hasActualAncestor: true,
                    loc: getLocByIndex(5, 10),
                    next: nodeList[0].children[1]
                },
                {
                    tag: "pre",
                    children: [
                        {
                            content: [
                                {
                                    value: "\n        ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(15, 24)
                                }
                            ],
                            preWhiteSpace: true,
                            hasActualAncestor: true,
                            loc: getLocByIndex(15, 24),
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
                                            loc: getLocByIndex(30, 55),
                                            value: "\n            ...\n        "
                                        }
                                    ],
                                    preWhiteSpace: true,
                                    hasActualAncestor: true,
                                    loc: getLocByIndex(30, 55),
                                    parent: nodeList[0].children[1].children[1]
                                }
                            ],
                            preWhiteSpace: true,
                            loc: getLocByIndex(24, 62),
                            hasActualAncestor: true,
                            parent: nodeList[0].children[1],
                            startTagEndPos: getPosByIndex(30),
                            endTagStartPos: getPosByIndex(55),
                            prev: nodeList[0].children[1].children[0],
                            next: nodeList[0].children[1].children[2]
                        },
                        {
                            content: [
                                {
                                    value: "\n    ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(62, 67)
                                }
                            ],
                            preWhiteSpace: true,
                            hasActualAncestor: true,
                            loc: getLocByIndex(62, 67),
                            parent: nodeList[0].children[1],
                            prev: nodeList[0].children[1].children[1]
                        }
                    ],
                    preWhiteSpace: true,
                    parent: nodeList[0],
                    hasActualAncestor: true,
                    loc: getLocByIndex(10, 73),
                    prev: nodeList[0].children[0],
                    next: nodeList[0].children[2],
                    startTagEndPos: getPosByIndex(15),
                    endTagStartPos: getPosByIndex(67)
                },
                {
                    content: [
                        {
                            value: "\n",
                            isInterpolated: false,
                            loc: getLocByIndex(73, 74)
                        }
                    ],
                    parent: nodeList[0],
                    hasActualAncestor: true,
                    loc: getLocByIndex(73, 74),
                    prev: nodeList[0].children[1]
                }
            ],
            loc: getLocByIndex(0, 80),
            startTagEndPos: getPosByIndex(5),
            endTagStartPos: getPosByIndex(74)
        })
    })

    test("Nesting structure with preWhiteSpace property modified through comments", () => {
        const nodeList = parseTemplateTesting(
            formatSourceCode(`
                <div>
                    <!--white-space:pre-wrap-->
                    <p>
                        <span>
                            ...
                        </span>
                    </p>
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
                    hasActualAncestor: true,
                    loc: getLocByIndex(5, 10),
                    next: nodeList[0].children[1]
                },
                {
                    tag: "!",
                    children: [
                        {
                            content: [
                                {
                                    isInterpolated: false,
                                    loc: getLocByIndex(14, 34),
                                    value: "white-space:pre-wrap"
                                }
                            ],
                            preWhiteSpace: true,
                            hasActualAncestor: true,
                            loc: getLocByIndex(14, 34),
                            parent: nodeList[0].children[1]
                        }
                    ],
                    parent: nodeList[0],
                    preWhiteSpace: true,
                    hasActualAncestor: true,
                    loc: getLocByIndex(10, 37),
                    prev: nodeList[0].children[0],
                    next: nodeList[0].children[2],
                    startTagEndPos: getPosByIndex(14),
                    endTagStartPos: getPosByIndex(34)
                },
                {
                    content: [
                        {
                            value: "\n    ",
                            isInterpolated: false,
                            loc: getLocByIndex(37, 42)
                        }
                    ],
                    parent: nodeList[0],
                    hasActualAncestor: true,
                    loc: getLocByIndex(37, 42),
                    prev: nodeList[0].children[1],
                    next: nodeList[0].children[3]
                },
                {
                    tag: "p",
                    children: [
                        {
                            content: [
                                {
                                    value: "\n        ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(45, 54)
                                }
                            ],
                            preWhiteSpace: true,
                            hasActualAncestor: true,
                            loc: getLocByIndex(45, 54),
                            parent: nodeList[0].children[3],
                            next: nodeList[0].children[3].children[1]
                        },
                        {
                            tag: "span",
                            children: [
                                {
                                    content: [
                                        {
                                            isInterpolated: false,
                                            loc: getLocByIndex(60, 85),
                                            value: "\n            ...\n        "
                                        }
                                    ],
                                    preWhiteSpace: true,
                                    hasActualAncestor: true,
                                    loc: getLocByIndex(60, 85),
                                    parent: nodeList[0].children[3].children[1]
                                }
                            ],
                            preWhiteSpace: true,
                            hasActualAncestor: true,
                            loc: getLocByIndex(54, 92),
                            parent: nodeList[0].children[3],
                            startTagEndPos: getPosByIndex(60),
                            endTagStartPos: getPosByIndex(85),
                            prev: nodeList[0].children[3].children[0],
                            next: nodeList[0].children[3].children[2]
                        },
                        {
                            content: [
                                {
                                    value: "\n    ",
                                    isInterpolated: false,
                                    loc: getLocByIndex(92, 97)
                                }
                            ],
                            preWhiteSpace: true,
                            hasActualAncestor: true,
                            loc: getLocByIndex(92, 97),
                            parent: nodeList[0].children[3],
                            prev: nodeList[0].children[3].children[1]
                        }
                    ],
                    preWhiteSpace: true,
                    parent: nodeList[0],
                    hasActualAncestor: true,
                    loc: getLocByIndex(42, 101),
                    prev: nodeList[0].children[2],
                    next: nodeList[0].children[4],
                    startTagEndPos: getPosByIndex(45),
                    endTagStartPos: getPosByIndex(97)
                },
                {
                    content: [
                        {
                            value: "\n",
                            isInterpolated: false,
                            loc: getLocByIndex(101, 102)
                        }
                    ],
                    parent: nodeList[0],
                    hasActualAncestor: true,
                    loc: getLocByIndex(101, 102),
                    prev: nodeList[0].children[3]
                }
            ],
            loc: getLocByIndex(0, 108),
            startTagEndPos: getPosByIndex(5),
            endTagStartPos: getPosByIndex(102)
        })
    })

    test("Modify the display property of the element to be pre related through style attribute", () => {
        const nodeList = parseTemplateTesting(
            formatSourceCode(`
                <div>
                    <p style="white-space: pre">
                        ...
                    </p>
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
                    hasActualAncestor: true,
                    loc: getLocByIndex(5, 10),
                    next: nodeList[0].children[1]
                },
                {
                    tag: "p",
                    attributes: [
                        {
                            name: {
                                raw: "style",
                                loc: getLocByIndex(13, 18)
                            },
                            value: {
                                raw: "white-space: pre",
                                loc: getLocByIndex(20, 36)
                            },
                            equalSign: true,
                            valueEnclosure: "double",
                            loc: getLocByIndex(13, 37)
                        }
                    ],
                    children: [
                        {
                            content: [
                                {
                                    isInterpolated: false,
                                    loc: getLocByIndex(38, 55),
                                    value: "\n        ...\n    "
                                }
                            ],
                            preWhiteSpace: true,
                            hasActualAncestor: true,
                            loc: getLocByIndex(38, 55),
                            parent: nodeList[0].children[1]
                        }
                    ],
                    preWhiteSpace: true,
                    parent: nodeList[0],
                    hasActualAncestor: true,
                    loc: getLocByIndex(10, 59),
                    prev: nodeList[0].children[0],
                    next: nodeList[0].children[2],
                    startTagEndPos: getPosByIndex(38),
                    endTagStartPos: getPosByIndex(55)
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
                    hasActualAncestor: true,
                    loc: getLocByIndex(59, 60),
                    prev: nodeList[0].children[1]
                }
            ],
            loc: getLocByIndex(0, 66),
            startTagEndPos: getPosByIndex(5),
            endTagStartPos: getPosByIndex(60)
        })
    })
})
