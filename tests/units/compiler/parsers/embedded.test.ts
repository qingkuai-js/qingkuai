import { expect, test } from "vitest"
import { inputDescriptor } from "../../../../src/compiler/state"
import { formatSourceCode } from "../../../../src/util/shared/sundry"
import { matchCompileMessages } from "../../../../src/util/testing/match"
import { parseTemplateTesting } from "../../../../src/util/testing/sundry"
import { matchTemplateNodeList, matchTemplateNodeListAndMessages } from "./_match"
import { getLocByIndex, getPosByIndex } from "../../../../src/util/compiler/position"

test("Single embedded script language block", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <lang-js>
                let name = "World"
                setTimeout(() => {
                    name = "QingKuai"
                })
            </lang-js>
        `)
    )
    matchTemplateNodeList(nodeList, {
        tag: "lang-js",
        children: [
            {
                content: [
                    {
                        isInterpolated: false,
                        loc: getLocByIndex(9, 89),
                        value: `\n    let name = "World"\n    setTimeout(() => {\n        name = "QingKuai"\n    })\n`
                    }
                ],
                parent: nodeList[0],
                preWhiteSpace: true,
                loc: getLocByIndex(9, 89)
            }
        ],
        isEmbedded: true,
        preWhiteSpace: true,
        loc: getLocByIndex(0, 99),
        startTagEndPos: getPosByIndex(9),
        endTagStartPos: getPosByIndex(89)
    })
})

test("Single embedded style language block", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <lang-css>
                .container {
                    background-color: red;
                }
            </lang-css>
        `)
    )
    matchTemplateNodeList(nodeList, {
        tag: "lang-css",
        children: [
            {
                content: [
                    {
                        isInterpolated: false,
                        loc: getLocByIndex(10, 65),
                        value: "\n    .container {\n        background-color: red;\n    }\n"
                    }
                ],
                parent: nodeList[0],
                preWhiteSpace: true,
                loc: getLocByIndex(10, 65)
            }
        ],
        isEmbedded: true,
        preWhiteSpace: true,
        loc: getLocByIndex(0, 76),
        startTagEndPos: getPosByIndex(10),
        endTagStartPos: getPosByIndex(65)
    })
})

test("Whether multiple embedded script language block will cause parsing error", () => {
    matchTemplateNodeListAndMessages(() => {
        const nodeList = parseTemplateTesting(
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
                preWhiteSpace: true,
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
                preWhiteSpace: true,
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
    const nodeList = parseTemplateTesting(
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
            preWhiteSpace: true,
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
            preWhiteSpace: true,
            loc: getLocByIndex(22, 45),
            startTagEndPos: getPosByIndex(33),
            endTagStartPos: getPosByIndex(33)
        }
    )
})

test("Whether <script> and <style> element will not be parsed as embedded language block", () => {
    const nodeList = parseTemplateTesting(
        formatSourceCode(`
            <script>
                console.log()
            </script>
            <style>
                .container {}
            </style>
        `)
    )
    matchTemplateNodeList(
        nodeList,
        {
            tag: "script",
            children: [
                {
                    content: [
                        {
                            isInterpolated: false,
                            loc: getLocByIndex(8, 27),
                            value: `\n    console.log()\n`
                        }
                    ],
                    parent: nodeList[0],
                    preWhiteSpace: true,
                    loc: getLocByIndex(8, 27)
                }
            ],
            next: nodeList[1],
            preWhiteSpace: true,
            loc: getLocByIndex(0, 36),
            startTagEndPos: getPosByIndex(8),
            endTagStartPos: getPosByIndex(27)
        },
        {
            content: [
                {
                    value: "\n",
                    isInterpolated: false,
                    loc: getLocByIndex(36, 37)
                }
            ],
            prev: nodeList[0],
            next: nodeList[2],
            loc: getLocByIndex(36, 37)
        },
        {
            tag: "style",
            children: [
                {
                    content: [
                        {
                            isInterpolated: false,
                            loc: getLocByIndex(44, 63),
                            value: "\n    .container {}\n"
                        }
                    ],
                    parent: nodeList[2],
                    preWhiteSpace: true,
                    loc: getLocByIndex(44, 63)
                }
            ],
            prev: nodeList[1],
            preWhiteSpace: true,
            loc: getLocByIndex(37, 71),
            startTagEndPos: getPosByIndex(44),
            endTagStartPos: getPosByIndex(63)
        }
    )
})

test("Embedded style block without end tag reports unclosed start tag", () => {
    parseTemplateTesting("<style>.a{color:red}", {
        recover: true
    })
    matchCompileMessages([
        {
            type: "error",
            range: [0, 6],
            value: "The start tag <style> is not closed."
        }
    ])
})

test("Embedded script end tag without closing angle reports end tag not closed", () => {
    parseTemplateTesting("<script>console.log(1)</script", {
        recover: true
    })
    matchCompileMessages([
        {
            type: "error",
            range: [22, 30],
            value: "The end tag </script> is not closed."
        }
    ])
})

test("Embedded language blocks nested in normal elements are rejected", () => {
    parseTemplateTesting("<div><lang-js></lang-js></div>", {
        recover: true
    })
    matchCompileMessages([
        {
            type: "error",
            range: [5, 13],
            value: "The embedded language block <lang-js> can only be used in the top level of the template."
        }
    ])
})

test("Embedded style: self-closing with src generates virtual import code", () => {
    const nodeList = parseTemplateTesting(`<lang-css src="./theme.css" />`)

    expect(nodeList.length).toBe(1)
    expect(nodeList[0].tag).toBe("lang-css")
    expect(nodeList[0].isSelfClosing).toBe(true)
    expect(inputDescriptor.styles).toEqual([
        expect.objectContaining({
            lang: "css",
            global: false,
            code: `@import "./theme.css";`
        })
    ])
})

test("Embedded style: src uses @use for scss-like languages", () => {
    parseTemplateTesting(`<lang-scss src="./theme.scss"></lang-scss>`)

    expect(inputDescriptor.styles).toEqual([
        expect.objectContaining({
            lang: "scss",
            global: false,
            code: `@use "./theme.scss";`
        })
    ])
})

test("Embedded style: global attribute marks style descriptor as global", () => {
    parseTemplateTesting(`<lang-css global src="./theme.css" />`)

    expect(inputDescriptor.styles).toEqual([
        expect.objectContaining({
            lang: "css",
            global: true,
            code: `@import "./theme.css";`
        })
    ])
})

test("Embedded style: self-closing block without src reports error", () => {
    parseTemplateTesting(`<lang-css />`, {
        recover: true
    })

    matchCompileMessages([
        {
            type: "error",
            range: [0, 9],
            value: `The self-closing embedded style tag <lang-css> must have a "src" attribute to specify the source file of the style.`
        }
    ])
})

test("Embedded style: style block with src cannot have content", () => {
    parseTemplateTesting(`<lang-css src="./theme.css">.a{color:red}</lang-css>`, {
        recover: true
    })

    matchCompileMessages([
        {
            type: "error",
            range: [0, 9],
            value: `The embedded style tag <lang-css> with a "src" attribute cannot have content.`
        }
    ])
})
