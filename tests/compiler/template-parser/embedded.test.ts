import { test } from "vitest"
import { formatSourceCode } from "../../../src/util/testing/sundry"
import { parseTemplateStandalone } from "../../../src/compiler/parser/template"
import { getLocByIndex, getPosByIndex } from "../../../src/util/compiler/position"
import { matchTemplateNodeList, matchTemplateNodeListAndMessages } from "./_match"

test("Single embedded script language block", () => {
    matchTemplateNodeList(
        parseTemplateStandalone(
            formatSourceCode(`
                <lang-js>
                    let name = "World"
                    setTimeout(() => {
                        name = "QingKuai"
                    })
                </lang-js>
            `)
        ),
        {
            tag: "lang-js",
            content: [
                {
                    isInterpolated: false,
                    loc: getLocByIndex(9, 89),
                    value: `\n    let name = "World"\n    setTimeout(() => {\n        name = "QingKuai"\n    })\n`
                }
            ],
            isEmbedded: true,
            loc: getLocByIndex(0, 99),
            startTagEndPos: getPosByIndex(9),
            endTagStartPos: getPosByIndex(89)
        }
    )
})

test("Single embedded style language block", () => {
    matchTemplateNodeList(
        parseTemplateStandalone(
            formatSourceCode(`
                <lang-css>
                    .container {
                        background-color: red;
                    }
                </lang-css>
            `)
        ),
        {
            tag: "lang-css",
            content: [
                {
                    isInterpolated: false,
                    loc: getLocByIndex(10, 65),
                    value: "\n    .container {\n        background-color: red;\n    }\n"
                }
            ],
            isEmbedded: true,
            loc: getLocByIndex(0, 76),
            startTagEndPos: getPosByIndex(10),
            endTagStartPos: getPosByIndex(65)
        }
    )
})

test("Whether multiple embedded script language block will cause parsing error", () => {
    matchTemplateNodeListAndMessages(() => {
        const nodeList = parseTemplateStandalone(
            formatSourceCode(`
                <lang-js></lang-js>
                <lang-ts></lang-ts>
            `),
            { recover: true }
        )
        return [
            nodeList,
            {
                tag: "lang-js",
                isEmbedded: true,
                next: nodeList[1],
                loc: getLocByIndex(0, 19),
                startTagEndPos: getPosByIndex(9),
                endTagStartPos: getPosByIndex(9)
            },
            {
                content: [
                    {
                        value: "\n",
                        isInterpolated: false,
                        loc: getLocByIndex(19, 20)
                    }
                ],
                prev: nodeList[0],
                next: nodeList[2],
                loc: getLocByIndex(19, 20)
            },
            {
                tag: "lang-ts",
                isEmbedded: true,
                prev: nodeList[1],
                loc: getLocByIndex(20, 39),
                startTagEndPos: getPosByIndex(29),
                endTagStartPos: getPosByIndex(29)
            }
        ]
    }, [
        {
            type: "error",
            range: [20, 28],
            value: "The embedded script block is out of limit: only one is allowed."
        }
    ])
})

test("Whether multiple embedded style language blocks will not cause parsing error", () => {
    const nodeList = parseTemplateStandalone(
        formatSourceCode(`
            <lang-css></lang-css>
            <lang-scss></lang-scss>
        `)
    )
    matchTemplateNodeList(
        nodeList,
        {
            tag: "lang-css",
            isEmbedded: true,
            next: nodeList[1],
            loc: getLocByIndex(0, 21),
            startTagEndPos: getPosByIndex(10),
            endTagStartPos: getPosByIndex(10)
        },
        {
            content: [
                {
                    value: "\n",
                    isInterpolated: false,
                    loc: getLocByIndex(21, 22)
                }
            ],
            prev: nodeList[0],
            next: nodeList[2],
            loc: getLocByIndex(21, 22)
        },
        {
            tag: "lang-scss",
            isEmbedded: true,
            prev: nodeList[1],
            loc: getLocByIndex(22, 45),
            startTagEndPos: getPosByIndex(33),
            endTagStartPos: getPosByIndex(33)
        }
    )
})

test("Whether <script> and <style> element will not be parsed as embedded language block", () => {
    const nodeList = parseTemplateStandalone(
        formatSourceCode(`
            <script></script>
            <style></style>
        `)
    )
    matchTemplateNodeList(
        nodeList,
        {
            tag: "script",
            next: nodeList[1],
            loc: getLocByIndex(0, 17),
            startTagEndPos: getPosByIndex(8),
            endTagStartPos: getPosByIndex(8)
        },
        {
            content: [
                {
                    value: "\n",
                    isInterpolated: false,
                    loc: getLocByIndex(17, 18)
                }
            ],
            prev: nodeList[0],
            next: nodeList[2],
            loc: getLocByIndex(17, 18)
        },
        {
            tag: "style",
            prev: nodeList[1],
            loc: getLocByIndex(18, 33),
            startTagEndPos: getPosByIndex(25),
            endTagStartPos: getPosByIndex(25)
        }
    )
})
