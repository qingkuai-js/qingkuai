import type { Pair } from "#type-declarations/tools"

import {
    matchGeneratedFragment,
    matchTemplateNodesAnchorId,
    matchTemplateNodesRuntimeId
} from "./_match"
import { describe, test } from "vitest"
import { formatSourceCode } from "../../../src/util/testing/sundry"

function getRandomDirective() {
    return ["#if={bool}", "#for={3}", "#show={display}", "#target={document.body}"][
        Math.floor(Math.random() * 4)
    ]
}

test("Empty content", () => {
    matchGeneratedFragment("", "")
    matchGeneratedFragment("", "", {
        debug: true
    })
})

describe("Whitespace rule", () => {
    test("trim", () => {
        const data: Pair<string>[] = [
            [" ... ", "..."],
            ["  1 2  3   0  ", "1 2  3   0"],
            ["\n<div>\n\t...\n</div>", "<div>...</div>"],
            ["\n<div>\n\t1 2  3   0\n</div>", "<div>1 2  3   0</div>"],
            ["<div>\n\t<p>\n\t\t1 2  3   0\n\t</p>\n</div>", "<div><p>1 2  3   0</p></div>"]
        ]
        for (const [from, to] of data) {
            matchGeneratedFragment(
                from,
                `
                    const getFragment = _.createFragmentGetter(\`${to}\`)
                    const fragment = getFragment()
                `,
                {
                    whitespace: "trim"
                }
            )
        }
        matchGeneratedFragment("    ", "")
    })

    test("preserve", () => {
        const data: string[] = [
            "    ",
            " ... ",
            "  1 2  3   0  ",
            "\n<div>\n\t...\n</div>",
            "\n<div>\n\t1 2  3   0\n</div>",
            "<div>\n\t<p>\n\t\t1 2  3   0\n\t</p>\n</div>"
        ]
        for (const item of data) {
            matchGeneratedFragment(
                item,
                `
                    const getFragment = _.createFragmentGetter(\`${item}\`)
                    const fragment = getFragment()
                `,
                {
                    whitespace: "preserve"
                }
            )
        }
    })

    test("collapse", () => {
        const data: Pair<string>[] = [
            ["    ", " "],
            [" ... ", " ... "],
            ["  1 2  3   0  ", " 1 2 3 0 "],
            ["\n<div>\n\t...\n</div>", " <div> ... </div>"],
            ["\n<div>\n\t1 2  3   0\n</div>", " <div> 1 2 3 0 </div>"],
            ["<div>\n\t<p>\n\t\t1 2  3   0\n\t</p>\n</div>", "<div> <p> 1 2 3 0 </p> </div>"]
        ]
        for (const [from, to] of data) {
            matchGeneratedFragment(
                from,
                `
                    const getFragment = _.createFragmentGetter(\`${to}\`)
                    const fragment = getFragment()
                `,
                {
                    whitespace: "collapse"
                }
            )
        }
    })

    test("trim-collapse", () => {
        const data: Pair<string>[] = [
            [" ... ", "..."],
            ["  1 2  3   0  ", "1 2 3 0"],
            ["\n<div>\n\t...\n</div>", "<div>...</div>"],
            ["\n<div>\n\t1 2  3   0\n</div>", "<div>1 2 3 0</div>"],
            ["<div>\n\t<p>\n\t\t1 2  3   0\n\t</p>\n</div>", "<div><p>1 2 3 0</p></div>"]
        ]
        for (const [from, to] of data) {
            matchGeneratedFragment(
                from,
                `
                    const getFragment = _.createFragmentGetter(\`${to}\`)
                    const fragment = getFragment()
                `
            )
        }
        matchGeneratedFragment("    ", "")
    })
})

test("Single tag", () => {
    matchGeneratedFragment(
        " <div> </div> ",
        `
            const getFragment = _.createFragmentGetter(\`<div></div>\`)
            const fragment = getFragment()
            `
    )

    matchGeneratedFragment(
        `
            <lang-js>
                let getFragment, fragment
            </lang-js>
            <span> 1 2  3   0</span>   
        `,
        `
            const getFragment1 = _.createFragmentGetter(\`<span>1 2 3 0</span>\`)
            const fragment1 = getFragment1()
        `
    )

    const nodeList = matchGeneratedFragment(
        "<div>{a}</div>",
        `
            const getFragment = _.createFragmentGetter(\`<div> </div>\`)
            const fragment = getFragment()
            const div1 = _.getChild(fragment)
            const text1 = _.getChild(div1)
        `
    )
    matchTemplateNodesRuntimeId([
        [nodeList[0], "div1"],
        [nodeList[0].children[0], "text1"]
    ])
})

test("Comment tag", () => {
    matchGeneratedFragment("<!-- xxx -->", "")

    matchGeneratedFragment(
        "<!-- xxx -->",
        `
            const getFragment = _.createFragmentGetter(\`<!-- xxx -->\`)
            const fragment = getFragment()
        `,
        {
            preserveCommentNodes: true
        }
    )

    matchGeneratedFragment(
        `
            <!-- a -->
            <!-- b -->
        `,
        `
            const compressStrings = ["<!--", "-->"]
            const getFragment = _.createFragmentGetter(\`/0 a /1/0 b /1\`, compressStrings)
            const fragment = getFragment()
        `,
        {
            preserveCommentNodes: true
        }
    )

    matchGeneratedFragment(
        `
            <!-- a -->
            <!-- b -->
        `,
        `
            const getFragment = _.createFragmentGetter(\`<!-- a --><!-- b -->\`)
            const fragment = getFragment()
        `,
        {
            debug: true,
            preserveCommentNodes: true
        }
    )
})

test("Self-closing tag", () => {
    matchGeneratedFragment(
        "<input class='container' />",
        `
            const getFragment = _.createFragmentGetter(\`<input class=container>\`)
            const fragment = getFragment()
        `
    )

    const nodeList = matchGeneratedFragment(
        "<input !id />",
        `
            const getFragment = _.createFragmentGetter(\`<input>\`)
            const fragment = getFragment()
            const input1 = _.getChild(fragment)
        `
    )
    matchTemplateNodesRuntimeId([[nodeList[0], "input1"]])
})

test("Spread tag", () => {
    let nodeList = matchGeneratedFragment(
        `
            <qk:spread>
                <button @click={() => {}}></button>
            </qk:spread>
        `,
        `
            const getFragment = _.createFragmentGetter(\`<button></button>\`)
            const fragment = getFragment()
            const button1 = _.getChild(fragment)
        `
    )
    matchTemplateNodesRuntimeId([[nodeList[1].children[1], "button1"]])

    nodeList = matchGeneratedFragment(
        `
            <qk:spread>
                <qk:spread>
                    name: <span> {name} </span>
                </qk:spread>
            </qk:spread>
        `,
        `
            const getFragment = _.createFragmentGetter(\`name:<span> </span>\`)
            const fragment = getFragment()
            const span1 = _.getChild(fragment, 1)
            const text1 = _.getChild(span1)
        `
    )
    matchTemplateNodesRuntimeId([
        [nodeList[1].children[1].children[1], "span1"],
        [nodeList[1].children[1].children[1].children[0], "text1"]
    ])
})

test("Directives", () => {
    let nodeList = matchGeneratedFragment(
        `
            <div #for={item of 3}>{item}</div>
        `,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`<div> </div>\`)
            const fragment1 = getFragment1()
            const div1 = _.getChild(fragment1)
            const text2 = _.getChild(div1)
        `
    )
    matchTemplateNodesRuntimeId([
        [nodeList[1], "div1"],
        [nodeList[1].children[0], "text2"]
    ])
    matchTemplateNodesAnchorId([[nodeList[1], "text1"]])

    nodeList = matchGeneratedFragment(
        `
            <div #if={bool}>
                <p #for={item of 3}>
                    {item}
                </p>
            </div>
            <div #else>
                <p> no content </p>
            </div>
        `,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`<div> </div>\`)
            const fragment1 = getFragment1()
            const div1 = _.getChild(fragment1)
            const text2 = _.getChild(div1)

            const getFragment2 = _.createFragmentGetter(\`<p> </p>\`)
            const fragment2 = getFragment2()
            const p1 = _.getChild(fragment2)
            const text3 = _.getChild(p1)

            const getFragment3 = _.createFragmentGetter(\`<div><p>no content</p></div>\`)
            const fragment3 = getFragment3()
            const div2 = _.getChild(fragment3)
        `,
        {
            debug: true
        }
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "text1"],
        [nodeList[3], "text1"]
    ])
    matchTemplateNodesRuntimeId([
        [nodeList[1], "div1"],
        [nodeList[3], "div2"],
        [nodeList[1].children[1], "p1"],
        [nodeList[1].children[1].children[0], "text3"]
    ])
})

test("Directives on spread tag", () => {
    let nodeList = matchGeneratedFragment(
        `
            <qk:spread #for={item of 3}>
                <div>
                    {item}
                </div>
            </qk:spread>
        `,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`<div> </div>\`)
            const fragment1 = getFragment1()
            const div1 = _.getChild(fragment1)
            const text2 = _.getChild(div1)
        `
    )
    matchTemplateNodesAnchorId([[nodeList[1], "text1"]])
    matchTemplateNodesRuntimeId([[nodeList[1].children[1], "div1"]])

    nodeList = matchGeneratedFragment(
        `
            <qk:spread #for={item of 3}>
                <div #if={item}>
                    ok
                </div>
            </qk:spread>
        `,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`<div>ok</div>\`)
            const fragment1 = getFragment1()
            const div1 = _.getChild(fragment1)
        `
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "text1"],
        [nodeList[1].children[1], "text1"]
    ])
    matchTemplateNodesRuntimeId([[nodeList[1].children[1], "div1"]])

    nodeList = matchGeneratedFragment(
        `
            <qk:spread #for={item of 3}>
                <qk:spread #if={item}>
                    <div #target={"body"}>
                        <p> {item} </p>
                    </div>
                </qk:spread>
            </qk:spread>
        `,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`<div><p> </p></div>\`)
            const fragment1 = getFragment1()
            const div1 = _.getChild(fragment1)
            const p1 = _.getChild(div1)
            const text2 = _.getChild(p1)
        `
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "text1"],
        [nodeList[1].children[1], "text1"],
        [nodeList[1].children[1].children[1], "text1"]
    ])
    matchTemplateNodesRuntimeId([
        [nodeList[1].children[1].children[1], "div1"],
        [nodeList[1].children[1].children[1].children[1], "p1"],
        [nodeList[1].children[1].children[1].children[1].children[0], "text2"]
    ])
})

test("Component tag", () => {
    for (let i = 0; i < 2; i++) {
        const directive = i ? getRandomDirective() : ""

        let nodeList = matchGeneratedFragment(
            `<Comp ${directive} />`,
            `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)
        `
        )
        matchTemplateNodesAnchorId([[nodeList[0], "text1"]])

        nodeList = matchGeneratedFragment(
            formatSourceCode(`
                <Comp ${directive}>
                    static content
                    <p #slot={"xxx"}></p>
                </Comp>
            `),
            `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`\\n    static content\\n    \`)
            const fragment1 = getFragment1()

            const getFragment2 = _.createFragmentGetter(\`<p></p>\`)
            const fragment2 = getFragment2()
            const p1 = _.getChild(fragment2)
        `,
            {
                debug: true,
                whitespace: "preserve"
            }
        )
        matchTemplateNodesAnchorId([[nodeList[0], "text1"]])
        matchTemplateNodesRuntimeId([[nodeList[0].children[1], "p1"]])

        nodeList = matchGeneratedFragment(
            `
            <Comp ${directive}>
                <div #for={a} #slot={"a"} !id></div>
                <div #show={b} #slot={"b"}> {content} </div>
            </Comp>
        `,
            `
            const compressStrings = ["<div", "</div>"]
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`/0>/1\`, compressStrings)
            const fragment1 = getFragment1()
            const div1 = _.getChild(fragment1)

            const getFragment2 = _.createFragmentGetter(\`/0> /1\`, compressStrings)
            const fragment2 = getFragment2()
            const div2 = _.getChild(fragment2)
            const text2 = _.getChild(div2)
        `
        )
        matchTemplateNodesAnchorId([
            [nodeList[1], "text1"],
            [nodeList[1].children[1], ""],
            [nodeList[1].children[3], ""]
        ])
        matchTemplateNodesRuntimeId([
            [nodeList[1].children[1], "div1"],
            [nodeList[1].children[3], "div2"],
            [nodeList[1].children[3].children[0], "text2"]
        ])

        nodeList = matchGeneratedFragment(
            `
            <Comp ${directive}>
                <div !id></div>
                <qk:spread #slot={"empty"}></qk:spread>
                <qk:spread #slot={context from "spread"}>
                    <p>{context.name}</p>
                    <button @click={context.handleClick}></button>
                </qk:spread>
            </Comp>
        `,
            `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`<div></div>\`)
            const fragment1 = getFragment1()
            const div1 = _.getChild(fragment1)

            const getFragment2 = _.createFragmentGetter(\`<p> </p><button></button>\`)
            const fragment2 = getFragment2()
            const p1 = _.getChild(fragment2)
            const text2 = _.getChild(p1)
            const button1 = _.getChild(fragment2, 1)
        `
        )
        matchTemplateNodesAnchorId([
            [nodeList[1], "text1"],
            [nodeList[1].children[1], ""],
            [nodeList[1].children[5], ""]
        ])
        matchTemplateNodesRuntimeId([
            [nodeList[1].children[1], "div1"],
            [nodeList[1].children[5].children[1], "p1"],
            [nodeList[1].children[5].children[3], "button1"]
        ])
    }
})

test("Component tag with preceding directive", () => {
    const nodeList = matchGeneratedFragment(
        `
                <Comp #if={a}>
                    <div></div>
                </Comp>
                <p #elif={b}></p>
            `,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`<div></div>\`)
            const fragment1 = getFragment1()

            const getFragment2 = _.createFragmentGetter(\`<p></p>\`)
            const fragment2 = getFragment2()
            const p1 = _.getChild(fragment2)
        `
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "text1"],
        [nodeList[3], "text1"]
    ])
    matchTemplateNodesRuntimeId([[nodeList[3], "p1"]])
})

test("Slot in component", () => {
    let nodeList = matchGeneratedFragment(
        `
            <Comp>
                <slot>
                    <div !id></div>
                </slot>
            </Comp>
        `,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`<div></div>\`)
            const fragment1 = getFragment1()
            const div1 = _.getChild(fragment1)
        `
    )
    matchTemplateNodesAnchorId([[nodeList[1], "text1"]])
    matchTemplateNodesRuntimeId([[nodeList[1].children[1].children[1], "div1"]])

    nodeList = matchGeneratedFragment(
        `
            <Comp ${getRandomDirective()}>
                <slot>
                    <div !id></div>
                </slot>
                <slot name="xxx" #slot={"xxx"}>
                    <p> {content} </p>
                </slot>
            </Comp>
        `,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`<div></div>\`)
            const fragment1 = getFragment1()
            const div1 = _.getChild(fragment1)

            const getFragment2 = _.createFragmentGetter(\`<p> </p>\`)
            const fragment2 = getFragment2()
            const p1 = _.getChild(fragment2)
            const text2 = _.getChild(p1)
        `
    )
    matchTemplateNodesRuntimeId([
        [nodeList[1].children[1].children[1], "div1"],
        [nodeList[1].children[3].children[1], "p1"],
        [nodeList[1].children[3].children[1].children[0], "text2"]
    ])
    matchTemplateNodesAnchorId([[nodeList[1], "text1"]])
})

test("Nesting components", () => {
    let nodeList = matchGeneratedFragment(
        `
            <Comp>
                <Test />
            </Comp>
        `,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)
        `
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "text1"],
        [nodeList[1].children[1], ""]
    ])

    nodeList = matchGeneratedFragment(
        `
            <Comp ${getRandomDirective()}>
                <Test1 />
                <Test2 #slot={"2"} />
            </Comp>
        `,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)
        `
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "text1"],
        [nodeList[1].children[1], ""]
    ])
})

test("Slot tag", () => {
    let nodeList = matchGeneratedFragment(
        `<slot></slot>`,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)
        `
    )
    matchTemplateNodesAnchorId([[nodeList[0], "text1"]])

    nodeList = matchGeneratedFragment(
        `
            <slot>
                <div !id></div>
            </slot>
        `,
        `
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`<div></div>\`)
            const fragment1 = getFragment1()
            const div1 = _.getChild(fragment1)
        `
    )
    matchTemplateNodesAnchorId([[nodeList[1], "text1"]])
    matchTemplateNodesRuntimeId([[nodeList[1].children[1], "div1"]])
})

test("Directives on slot tag", () => {
    const nodeList = matchGeneratedFragment(
        `
            <slot #for={item, index of 3}>
                <span>{index}</span>
                :
                <span>{item}</span>
            </slot>
        `,
        `
            const compressStrings = ["<span", "</span>"]
            const getFragment = _.createFragmentGetter(\` \`)
            const fragment = getFragment()
            const text1 = _.getChild(fragment)

            const getFragment1 = _.createFragmentGetter(\`/0> /1:/0> /1\`, compressStrings)
            const fragment1 = getFragment1()
            const span1 = _.getChild(fragment1)
            const text2 = _.getChild(span1)
            const span2 = _.getChild(fragment1, 2)
            const text3 = _.getChild(span2)
        `
    )
    matchTemplateNodesAnchorId([[nodeList[1], "text1"]])
    matchTemplateNodesRuntimeId([
        [nodeList[1].children[1], "span1"],
        [nodeList[1].children[3], "span2"],
        [nodeList[1].children[1].children[0], "text2"],
        [nodeList[1].children[3].children[0], "text3"]
    ])
})
