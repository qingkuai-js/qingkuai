import type { Pair } from "#type-declarations/tools"

import {
    matchGeneratedFragment,
    matchTemplateNodesAnchorId,
    matchTemplateNodesRuntimeId
} from "./_match"
import { describe, test } from "vitest"
import { formatSourceCode } from "../../../src/util/testing/sundry"

function getRandomDirective() {
    return ["#if={bool}", "#for={3}", "#target={document.body}", "#await={promise}"][
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
                `const _getFragment1 = _.createFragmentGetter(\`${to}\`)`,
                { whitespace: "trim" }
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
                `const _getFragment1 = _.createFragmentGetter(\`${item}\`)`,
                { whitespace: "preserve" }
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
                `const _getFragment1 = _.createFragmentGetter(\`${to}\`)`,
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
            matchGeneratedFragment(from, `const _getFragment1 = _.createFragmentGetter(\`${to}\`)`)
        }
        matchGeneratedFragment("    ", "")
    })
})

test("Single tag", () => {
    matchGeneratedFragment(
        " <div> </div> ",
        `const _getFragment1 = _.createFragmentGetter(\`<div></div>\`)`
    )

    matchGeneratedFragment(
        `
            <lang-js>
                let _getFragment, fragment
            </lang-js>
            <span> 1 2  3   0</span>
        `,
        `const _getFragment1 = _.createFragmentGetter(\`<span>1 2 3 0</span>\`)`
    )

    const nodeList = matchGeneratedFragment(
        "<div>{a}</div>",
        `const _getFragment1 = _.createFragmentGetter(\`<div> </div>\`)`
    )
    matchTemplateNodesRuntimeId([
        [nodeList[0], "_div1"],
        [nodeList[0].children[0], "_text1"]
    ])
})

test("Comment tag", () => {
    matchGeneratedFragment("<!-- xxx -->", "")

    matchGeneratedFragment(
        "<!-- xxx -->",
        `const _getFragment1 = _.createFragmentGetter(\`<!-- xxx -->\`)`,
        { preserveHtmlComments: true }
    )

    matchGeneratedFragment(
        `
            <!-- a -->
            <!-- b -->
        `,
        `
            const _compressStrings = ["<!--", "-->"]
            const _getFragment1 = _.createFragmentGetter(\`/0 a /1/0 b /1\`, _compressStrings)
        `,
        { preserveHtmlComments: true }
    )

    matchGeneratedFragment(
        `
            <!-- a -->
            <!-- b -->
        `,
        `const _getFragment1 = _.createFragmentGetter(\`<!-- a --><!-- b -->\`)`,
        {
            debug: true,
            preserveHtmlComments: true
        }
    )
})

test("Self-closing tag", () => {
    matchGeneratedFragment(
        "<input class='container' />",
        `const _getFragment1 = _.createFragmentGetter(\`<input class=container>\`)`
    )

    const nodeList = matchGeneratedFragment(
        "<input !id />",
        `const _getFragment1 = _.createFragmentGetter(\`<input>\`)`
    )
    matchTemplateNodesRuntimeId([[nodeList[0], "_input1"]])
})

test("Spread tag", () => {
    let nodeList = matchGeneratedFragment(
        `
            <qk:spread>
                <button @click={() => {}}></button>
            </qk:spread>
        `,
        `const _getFragment1 = _.createFragmentGetter(\`<button></button>\`)`
    )
    matchTemplateNodesRuntimeId([[nodeList[1].children[1], "_button1"]])

    nodeList = matchGeneratedFragment(
        `
            <qk:spread>
                <qk:spread>
                    name: <span> {name} </span>
                </qk:spread>
            </qk:spread>
        `,
        `const _getFragment1 = _.createFragmentGetter(\`name:<span> </span>\`)`
    )
    matchTemplateNodesRuntimeId([
        [nodeList[1].children[1].children[1], "_span1"],
        [nodeList[1].children[1].children[1].children[0], "_text1"]
    ])
})

test("Directives", () => {
    let nodeList = matchGeneratedFragment(
        `
            <div #for={item of 3}>{item}</div>
        `,
        `
            const _getFragment1 = _.createFragmentGetter(\` \`)
            const _getFragment2 = _.createFragmentGetter(\`<div> </div>\`)
        `
    )
    matchTemplateNodesRuntimeId([
        [nodeList[1], "_div1"],
        [nodeList[1].children[0], "_text2"]
    ])
    matchTemplateNodesAnchorId([[nodeList[1], "_text1"]])

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
            const _getFragment1 = _.createFragmentGetter(\` \`)
            const _getFragment2 = _.createFragmentGetter(\`<div> </div>\`)
            const _getFragment3 = _.createFragmentGetter(\`<p> </p>\`)
            const _getFragment4 = _.createFragmentGetter(\`<div><p>no content</p></div>\`)
        `,
        {
            debug: true
        }
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "_text1"],
        [nodeList[3], "_text1"]
    ])
    matchTemplateNodesRuntimeId([
        [nodeList[1], "_div1"],
        [nodeList[1].children[1], "_p1"],
        [nodeList[1].children[1].children[0], "_text3"]
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
            const _getFragment1 = _.createFragmentGetter(\` \`)
            const _getFragment2 = _.createFragmentGetter(\`<div> </div>\`)
        `
    )
    matchTemplateNodesAnchorId([[nodeList[1], "_text1"]])
    matchTemplateNodesRuntimeId([
        [nodeList[1].children[1], "_div1"],
        [nodeList[1].children[1].children[0], "_text2"]
    ])

    nodeList = matchGeneratedFragment(
        `
            <qk:spread #for={item of 3}>
                <div #if={item}>
                    ok
                </div>
            </qk:spread>
        `,
        `
            const _getFragment1 = _.createFragmentGetter(\` \`)
            const _getFragment2 = _.createFragmentGetter(\`<div>ok</div>\`)
        `
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "_text1"],
        [nodeList[1].children[1], "_text2"]
    ])

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
            const _getFragment1 = _.createFragmentGetter(\` \`)
            const _getFragment2 = _.createFragmentGetter(\`<div><p> </p></div>\`)
        `
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "_text1"],
        [nodeList[1].children[1], "_text2"],
        [nodeList[1].children[1].children[1], "_text3"]
    ])
    matchTemplateNodesRuntimeId([
        [nodeList[1].children[1].children[1], "_div1"],
        [nodeList[1].children[1].children[1].children[1], "_p1"],
        [nodeList[1].children[1].children[1].children[1].children[0], "_text4"]
    ])

    nodeList = matchGeneratedFragment(
        `
            <qk:spread #for={item of 3}>
                <div #if={item}></div>
                <div #else></div>
            </qk:spread>
        `,
        `
            const _getFragment1 = _.createFragmentGetter(\` \`)
            const _getFragment2 = _.createFragmentGetter(\`<div></div>\`)
        `
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "_text1"],
        [nodeList[1].children[1], "_text2"]
    ])
})

test("Component tag", () => {
    for (let i = 0; i < 2; i++) {
        const directive = i ? getRandomDirective() : ""

        let nodeList = matchGeneratedFragment(
            `<Comp ${directive} />`,
            `const _getFragment1 = _.createFragmentGetter(\` \`)`
        )
        matchTemplateNodesAnchorId([[nodeList[0], "_text1"]])

        nodeList = matchGeneratedFragment(
            formatSourceCode(`
                <Comp ${directive}>
                    static content
                    <p #slot={"xxx"}></p>
                </Comp>
            `),
            `
                const _getFragment1 = _.createFragmentGetter(\` \`)
                const _getFragment2 = _.createFragmentGetter(\`\\n    static content\\n    \`)
                const _getFragment3 = _.createFragmentGetter(\`<p></p>\`)
            `,
            {
                debug: true,
                whitespace: "preserve"
            }
        )
        matchTemplateNodesAnchorId([[nodeList[0], "_text1"]])

        nodeList = matchGeneratedFragment(
            `
                <Comp ${directive}>
                    <div #for={a} #slot={"a"} !id></div>
                    <div #if={bool} #slot={"b"}> {content} </div>
                </Comp>
            `,
            `
                const _compressStrings = ["<div", "</div>"]
                const _getFragment1 = _.createFragmentGetter(\` \`)
                const _getFragment2 = _.createFragmentGetter(\`/0>/1\`, _compressStrings)
                const _getFragment3 = _.createFragmentGetter(\`/0> /1\`, _compressStrings)
            `
        )
        matchTemplateNodesAnchorId([
            [nodeList[1], "_text1"],
            [nodeList[1].children[1], ""],
            [nodeList[1].children[3], ""]
        ])
        matchTemplateNodesRuntimeId([
            [nodeList[1].children[1], "_div1"],
            [nodeList[1].children[3], "_div2"],
            [nodeList[1].children[3].children[0], "_text2"]
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
                const _getFragment1 = _.createFragmentGetter(\` \`)
                const _getFragment2 = _.createFragmentGetter(\`<div></div>\`)
                const _getFragment3 = _.createFragmentGetter(\`<p> </p><button></button>\`)
            `
        )
        matchTemplateNodesAnchorId([
            [nodeList[1], "_text1"],
            [nodeList[1].children[1], ""],
            [nodeList[1].children[3], ""],
            [nodeList[1].children[5], ""]
        ])
        matchTemplateNodesRuntimeId([
            [nodeList[1].children[1], "_div1"],
            [nodeList[1].children[5].children[1], "_p1"],
            [nodeList[1].children[5].children[3], "_button1"]
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
            const _getFragment1 = _.createFragmentGetter(\` \`)
            const _getFragment2 = _.createFragmentGetter(\`<div></div>\`)
            const _getFragment3 = _.createFragmentGetter(\`<p></p>\`)
        `
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "_text1"],
        [nodeList[3], "_text1"]
    ])
})

test("Nesting components", () => {
    let nodeList = matchGeneratedFragment(
        `
            <Comp>
                <Test />
            </Comp>
        `,
        `const _getFragment1 = _.createFragmentGetter(\` \`)`
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "_text1"],
        [nodeList[1].children[1], ""]
    ])

    nodeList = matchGeneratedFragment(
        `
            <Comp ${getRandomDirective()}>
                <Test1 />
                <Test2 #slot={"2"} />
            </Comp>
        `,
        `const _getFragment1 = _.createFragmentGetter(\` \`)`
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "_text1"],
        [nodeList[1].children[1], ""],
        [nodeList[1].children[3], ""]
    ])
})

test("Slot tag", () => {
    let nodeList = matchGeneratedFragment(
        `<slot></slot>`,
        `const _getFragment1 = _.createFragmentGetter(\` \`)`
    )
    matchTemplateNodesAnchorId([[nodeList[0], "_text1"]])

    nodeList = matchGeneratedFragment(
        `
            <slot>
                <div !id></div>
            </slot>
        `,
        `
            const _getFragment1 = _.createFragmentGetter(\` \`)
            const _getFragment2 = _.createFragmentGetter(\`<div></div>\`)
        `
    )
    matchTemplateNodesAnchorId([[nodeList[1], "_text1"]])
    matchTemplateNodesRuntimeId([[nodeList[1].children[1], "_div1"]])
})

test("Slot tag in component", () => {
    let nodeList = matchGeneratedFragment(
        `
            <Comp>
                <slot>
                    <div !id></div>
                </slot>
            </Comp>
        `,
        `
            const _getFragment1 = _.createFragmentGetter(\` \`)
            const _getFragment2 = _.createFragmentGetter(\`<div></div>\`)
        `
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "_text1"],
        [nodeList[1].children[1], ""]
    ])
    matchTemplateNodesRuntimeId([[nodeList[1].children[1].children[1], "_div1"]])

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
            const _getFragment1 = _.createFragmentGetter(\` \`)
            const _getFragment2 = _.createFragmentGetter(\`<div></div>\`)
            const _getFragment3 = _.createFragmentGetter(\`<p> </p>\`)
        `
    )
    matchTemplateNodesAnchorId([
        [nodeList[1], "_text1"],
        [nodeList[1].children[1], ""],
        [nodeList[1].children[3], ""]
    ])
    matchTemplateNodesRuntimeId([
        [nodeList[1].children[1].children[1], "_div1"],
        [nodeList[1].children[3].children[1], "_p1"],
        [nodeList[1].children[3].children[1].children[0], "_text2"]
    ])
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
            const _compressStrings = ["<span", "</span>"]
            const _getFragment1 = _.createFragmentGetter(\` \`)
            const _getFragment2 = _.createFragmentGetter(\`/0> /1:/0> /1\`, _compressStrings)
        `
    )
    matchTemplateNodesAnchorId([[nodeList[1], "_text1"]])
    matchTemplateNodesRuntimeId([
        [nodeList[1].children[1], "_span1"],
        [nodeList[1].children[3], "_span2"],
        [nodeList[1].children[1].children[0], "_text2"],
        [nodeList[1].children[3].children[0], "_text3"]
    ])
})

test(`With "#html" directive`, () => {
    let nodeList = matchGeneratedFragment(
        `<div #html> static content </div>`,
        `const _getFragment1 = _.createFragmentGetter(\`<div> </div>\`)`
    )
    matchTemplateNodesRuntimeId([
        [nodeList[0], "_div1"],
        [nodeList[0].children[0], "_text1"]
    ])
    matchTemplateNodesAnchorId([[nodeList[0], ""]])

    nodeList = matchGeneratedFragment(
        `<div #html> hellow {name}! </div>`,
        `const _getFragment1 = _.createFragmentGetter(\`<div> </div>\`)`
    )
    matchTemplateNodesRuntimeId([
        [nodeList[0], "_div1"],
        [nodeList[0].children[0], "_text1"]
    ])
    matchTemplateNodesAnchorId([[nodeList[0], ""]])

    nodeList = matchGeneratedFragment(
        `<qk:spread #html> hello {name}! </qk:spread>`,
        `const _getFragment1 = _.createFragmentGetter(\` \`)`
    )
    matchTemplateNodesAnchorId([[nodeList[0], ""]])
    matchTemplateNodesRuntimeId([[nodeList[0].children[0], "_text1"]])

    nodeList = matchGeneratedFragment(
        `<qk:spread #html> static content </qk:spread>`,
        `const _getFragment1 = _.createFragmentGetter(\` \`)`
    )
    matchTemplateNodesAnchorId([[nodeList[0], ""]])
    matchTemplateNodesRuntimeId([[nodeList[0].children[0], "_text1"]])
})
