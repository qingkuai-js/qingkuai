import type { TemplateNode } from "../../compiler/types"
import type { ExpectTemplateNode, TemplateNodeParent } from "../types"

import { test, expect } from "vitest"
import { typedKeys } from "../../util/shared"
import { parseTemplate } from "../../compiler/parser/template"
import { setCompilerOptions } from "../../compiler/configuration"

function textNode(content: string, start: number): ExpectTemplateNode {
    return {
        tag: "",
        content,
        children: [],
        attributes: [],
        range: [start, start + content.length]
    }
}

function equalTemplateNode(
    target: TemplateNode,
    exp: ExpectTemplateNode,
    parent: TemplateNodeParent = null
) {
    expect(parent).toBe(parent)
    typedKeys(target).forEach(key => {
        if (key !== "parent" && key !== "children") {
            expect(target[key]).toEqual(exp[key])
        }
    })
    target.children.forEach((child, index) => {
        equalTemplateNode(child, exp.children[index], target)
    })
}

setCompilerOptions({
    reserveTemplateComment: true
})

test("comment", () => {
    let ret: any
    ret = parseTemplate("<!-- xxx -->")[0]
    equalTemplateNode(ret, {
        content: " xxx ",
        tag: "!",
        range: [0, 12],
        attributes: [],
        children: []
    })

    ret = parseTemplate("<div> <!-- </div> --> </div>")[0]
    equalTemplateNode(ret, {
        content: "",
        tag: "div",
        range: [0, 28],
        attributes: [],
        children: [
            {
                content: " </div> ",
                tag: "!",
                range: [6, 21],
                attributes: [],
                children: []
            }
        ]
    })

    const conditionalSource = `<!--[if IE]>
        <p>conditional content...</p>
    <![endif]-->`
    ret = parseTemplate(conditionalSource)[0]
    equalTemplateNode(ret, {
        content: conditionalSource.slice(4, -3),
        tag: "!",
        range: [0, 67],
        attributes: [],
        children: []
    })
})

test("invalid tag", () => {
    expect(() => {
        parseTemplate("123< ")
    }).toThrowError("Invalid tag")

    expect(() => {
        parseTemplate("<></>")
    }).toThrowError("Invalid tag")

    expect(() => {
        parseTemplate("< div></div>")
    }).toThrowError("Invalid tag")

    expect(() => {
        parseTemplate("<div></ div>")
    }).toThrowError("Invalid tag")
})

test("tag is not closing", () => {
    expect(() => {
        parseTemplate("<p><b></b>")
    }).toThrowError("The tag(p) is not closing.")

    expect(() => {
        parseTemplate("<div></div><aside> \n")
    }).toThrowError("The tag(aside) is not closing.")

    expect(() => {
        parseTemplate("<div><!-- </div> -->")
    }).toThrowError("The tag(div) is not closing.")
})

test("starts with end tag", () => {
    expect(() => {
        parseTemplate("</div><div></div>")
    }).toThrowError("Starts with an end tag: </div>")

    expect(() => {
        parseTemplate("<span ></span  ></span   1>")
    }).toThrowError("Starts with an end tag: </span   1>")

    expect(() => {
        parseTemplate("<strong>  </strog>")
    }).toThrowError("Starts with an end tag: </strog>")
})

test("general tag with some attributes", () => {
    const ret = parseTemplate(
        `<div id="10" class="a" !class="b" style="color:red; text-align:center;"> </div>`
    )[0]
    equalTemplateNode(ret, {
        content: "",
        tag: "div",
        range: [0, 79],
        attributes: [
            { key: "id", value: "10" },
            { key: "class", value: "a" },
            { key: "!class", value: "b" },
            { key: "style", value: "color:red; text-align:center;" }
        ],
        children: [textNode(" ", 72)]
    })
})

test("no value for attribute", () => {
    const ret = parseTemplate(`<c-aside id class style data-id="xxx" ></c-aside>`)[0]
    equalTemplateNode(ret, {
        content: "",
        tag: "c-aside",
        range: [0, 49],
        children: [],
        attributes: [
            { key: "id", value: "" },
            { key: "class", value: "" },
            { key: "style", value: "" },
            { key: "data-id", value: "xxx" }
        ]
    })
})

test("ignore access superfluous characters in end tag", () => {
    const ret = parseTemplate(`<main id=""></main 123 xxx>`)[0]
    equalTemplateNode(ret, {
        content: "",
        tag: "main",
        range: [0, 27],
        children: [],
        attributes: [{ key: "id", value: "" }]
    })
})

test("long template", () => {
    const ret = parseTemplate(`
    <header>
        <ul class="navigator">
            <li class="item1">url 1</li>
            <li class="item2">url 2</li>
            <li class="item3">url 3</li>
        </ul>
    </header>
    <aside id="aside1" class="left">
        <p> left content </p>
    </aside>
    <aside id="aside2" class="right" style="color:red">
        <p>right content</p>
    </aside>
    <footer>copyright info</footer>
    <!-- EOF -->
    `)

    equalTemplateNode(ret[0], {
        content: "",
        tag: "header",
        range: [5, 195],
        attributes: [],
        children: [
            {
                content: "",
                tag: "ul",
                range: [22, 181],
                attributes: [
                    {
                        key: "class",
                        value: "navigator"
                    }
                ],
                children: [
                    {
                        content: "",
                        tag: "li",
                        range: [57, 85],
                        attributes: [
                            {
                                key: "class",
                                value: "item1"
                            }
                        ],
                        children: [textNode("url 1", 75)]
                    },
                    {
                        content: "",
                        tag: "li",
                        range: [98, 126],
                        attributes: [
                            {
                                key: "class",
                                value: "item2"
                            }
                        ],
                        children: [textNode("url 2", 116)]
                    },
                    {
                        content: "",
                        tag: "li",
                        range: [139, 167],
                        attributes: [
                            {
                                key: "class",
                                value: "item3"
                            }
                        ],
                        children: [textNode("url 3", 157)]
                    }
                ]
            }
        ]
    })

    equalTemplateNode(ret[1], {
        content: "",
        tag: "aside",
        range: [200, 275],
        attributes: [
            {
                key: "id",
                value: "aside1"
            },
            {
                key: "class",
                value: "left"
            }
        ],
        children: [
            {
                content: "",
                tag: "p",
                range: [241, 262],
                attributes: [],
                children: [textNode(" left content ", 244)]
            }
        ]
    })

    equalTemplateNode(ret[2], {
        content: "",
        tag: "aside",
        range: [280, 373],
        attributes: [
            {
                key: "id",
                value: "aside2"
            },
            {
                key: "class",
                value: "right"
            },
            {
                key: "style",
                value: "color:red"
            }
        ],
        children: [
            {
                content: "",
                tag: "p",
                range: [340, 360],
                attributes: [],
                children: [textNode("right content", 343)]
            }
        ]
    })

    equalTemplateNode(ret[3], {
        content: "",
        tag: "footer",
        range: [378, 409],
        attributes: [],
        children: [textNode("copyright info", 386)]
    })

    equalTemplateNode(ret[4], {
        content: " EOF ",
        tag: "!",
        range: [414, 426],
        attributes: [],
        children: []
    })
})
