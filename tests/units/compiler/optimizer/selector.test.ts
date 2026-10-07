import { describe, expect, test } from "vitest"
import {
    getForBlockSelectorInfos,
    hasSelectorForAttribute,
    hasSelectorForTextNode,
    writeSelectorDeclaration
} from "../../../../src/compiler/optimizer/selector"
import { compile } from "../../../../src/compiler/compile"
import { analyzeResult } from "../../../../src/compiler/state"
import { formatSourceCode } from "../../../../src/util/shared/sundry"
import { RuntimeCodeWriter } from "../../../../src/compiler/transformer/writer"

function getForNodeContextFromAnalyzeResult() {
    for (const nodeContext of analyzeResult.template.nodeContexts.values()) {
        if (nodeContext.attributesMap["#for"]) {
            return nodeContext
        }
    }
}

test("getForBlockSelectorInfos returns empty when #for/#key pair is incomplete", () => {
    compile(`<div #for={item of items}>{foo[item.id]}</div>`)

    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    expect(getForBlockSelectorInfos(forNodeContext)).toEqual([])
})

test("getForBlockSelectorInfos collects selector operations from compiled template", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let selected = reactive("a")
            </lang-js>
            <div #for={item of items} #key={item.id} class="a b" !class={selected === item.id ? "on" : "off"} !title={selected === item.id}>
                <span>{selected === item.id}</span>
            </div>
        `)
    )
    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    const infos = getForBlockSelectorInfos(forNodeContext)
    expect(infos.some(item => item.operation.method === "setClassName")).toBe(true)
    expect(
        infos.some(
            item => item.operation.method === "setAttribute" && item.operation.attrName === "title"
        )
    ).toBe(true)

    // The inner text interpolation of the item cannot be taken over by the
    // selector (setText writing nodeValue is a no-op for element nodes)
    expect(infos.some(item => item.operation.method === "setText")).toBe(false)

    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let selected = reactive("a")
            </lang-js>
            <use #for={item of items} #key={item.id} !xlink:href={selected === item.id ? "#a" : "#b"}></use>
        `)
    )
    const useContext = getForNodeContextFromAnalyzeResult()!
    expect(
        getForBlockSelectorInfos(useContext).some(
            item => item.operation.method === "setXlinkAttribute"
        )
    ).toBe(true)

    // !value on <select> is intentionally excluded from selector optimization.
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let selected = reactive("a")
            </lang-js>
            <select #for={item of items} #key={item.id} !value={selected === item.id}></select>
        `)
    )
    const selectContext = getForNodeContextFromAnalyzeResult()!
    expect(getForBlockSelectorInfos(selectContext)).toEqual([])
})

test("hasSelectorForAttribute and hasSelectorForTextNode work with compiled selector infos", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let selected = reactive("a")
            </lang-js>
            <div #for={item of items} #key={item.id} !title={selected === item.id}>
                <span>{selected === item.id}</span>
            </div>
        `)
    )
    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    const infos = getForBlockSelectorInfos(forNodeContext)

    const titleInfo = infos.find(
        item => item.operation.method === "setAttribute" && item.operation.attrName === "title"
    )!
    expect(
        hasSelectorForAttribute(infos, titleInfo.targetNodeContext, titleInfo.targetAttribute!)
    ).toBe(true)

    // 项内层文本插值不再由选择器接管
    const textNodeContext = Array.from(analyzeResult.template.nodeContexts.values()).find(
        item => item.node.tag === ""
    )
    expect(textNodeContext).toBeTruthy()
    expect(hasSelectorForTextNode(infos, textNodeContext!)).toBe(false)
})

test("writeSelectorDeclaration emits update wrapper from compiled selector info", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let selected = reactive("a")
            </lang-js>
            <div #for={item of items} #key={item.id} !class={selected === item.id ? "on" : "off"}></div>
        `)
    )
    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    const selectorInfo = getForBlockSelectorInfos(forNodeContext).find(item => {
        return item.operation.method === "setClassName"
    })!
    const writer = new RuntimeCodeWriter(false)
    writeSelectorDeclaration(writer, selectorInfo, "getNode")
    expect(writer.code).toContain(`const ${selectorInfo.id} = (() => {`)
    expect(writer.code).toContain("const prevNode = getNode(prevValue)")
    expect(writer.code).toContain("const node = getNode(key)")
    expect(writer.code).toContain("setClassName(prevNode")
    expect(writer.code).toContain("setClassName(node")
})

test("getForBlockSelectorInfos returns empty for invalid #key expression node types", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let foo = { a: "x" }
            </lang-js>
            <div #for={item of items} #key={item.id + 1}>
                {foo[item.id]}
            </div>
        `)
    )

    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    expect(getForBlockSelectorInfos(forNodeContext)).toEqual([])
})

test("getForBlockSelectorInfos returns empty when #for context arg is missing", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let foo = { a: "x" }
            </lang-js>
            <div #for={items} #key={item.id}>
                {foo[item.id]}
            </div>
        `)
    )

    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    expect(getForBlockSelectorInfos(forNodeContext)).toEqual([])
})

test("getForBlockSelectorInfos skips non-optimizable children in for-block", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let foo = { a: "x" }
            </lang-js>
            <div #for={item of items} #key={item.id}>
                <Comp !title={foo[item.id]}></Comp>
                <slot !title={foo[item.id]}></slot>
                <div>static text</div>
                <div !title={foo[item.id]}></div>
                <select !value={foo[item.id]}></select>
            </div>
        `)
    )

    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    const infos = getForBlockSelectorInfos(forNodeContext)
    expect(infos.some(item => item.targetNodeContext.node.tag === "slot")).toBe(false)
    expect(infos.some(item => item.targetNodeContext.node.componentTag)).toBe(false)
    expect(
        infos.some(
            item => item.operation.method === "setAttribute" && item.operation.attrName === "value"
        )
    ).toBe(false)
})

test("getForBlockSelectorInfos validates selector expressions from compiled sources", () => {
    const cases = [
        {
            source: formatSourceCode(`
                <lang-js>
                    let items = [{ id: "a" }]
                    let foo = { a: "x" }
                    let bar = "y"
                </lang-js>
                <div #for={item of items} #key={item.id}>
                    {foo[item.id] + bar}
                </div>
            `),
            expectedEmpty: true
        },
        {
            source: formatSourceCode(`
                <lang-js>
                    let items = [{ id: "a", name: "n" }]
                    let foo = { n: "x" }
                </lang-js>
                <div #for={item of items} #key={item.id}>
                    {foo[item.name]}
                </div>
            `),
            expectedEmpty: true
        },
        {
            source: formatSourceCode(`
                <lang-js>
                    const items = [{ id: "a" }]
                    const foo = { a: "x" }
                </lang-js>
                <div #for={item of items} #key={item.id}>
                    {foo[item.id]}
                </div>
            `),
            // const 声明的 reactive 代理读取（transformTo 不带 .$）与成员访问依赖都不能优化
            expectedEmpty: true
        },
        {
            source: formatSourceCode(`
                <lang-js>
                    let items = [{ id: "a", other: "b" }]
                    let foo = { b: "x" }
                </lang-js>
                <div #for={item of items} #key={item.id}>
                    {foo[item.other]}
                </div>
            `),
            expectedEmpty: true
        },
        {
            source: formatSourceCode(`
                <lang-js>
                    let items = [{ id: "a" }]
                    let selected = reactive("a")
                </lang-js>
                <div #for={item of items} #key={item.id} !title={selected === item.id}></div>
            `),
            expectedEmpty: false
        }
    ]

    for (const { source, expectedEmpty } of cases) {
        compile(source)

        const forNodeContext = getForNodeContextFromAnalyzeResult()!
        const infos = getForBlockSelectorInfos(forNodeContext)
        if (expectedEmpty) {
            expect(infos).toEqual([])
        } else {
            expect(infos.length).toBeGreaterThan(0)
            expect(
                infos.some(
                    item =>
                        item.operation.method === "setAttribute" &&
                        item.operation.attrName === "title"
                )
            ).toBe(true)
        }
    }
})

test("getForBlockSelectorInfos ignores dynamic attributes without parsable expression", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let selected = reactive("a")
            </lang-js>
            <div #for={item of items} #key={item.id} !title={selected === item.id}>
                <div !title></div>
            </div>
        `)
    )

    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    const infos = getForBlockSelectorInfos(forNodeContext)
    expect(infos.some(item => item.operation.method === "setAttribute")).toBe(true)
    expect(infos.length).toBe(1)
})

test("getForBlockSelectorInfos skips selectors  contextusing from nested #for", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a", subs: [{ id: "x" }] }]
                let foo = { x: "ok" }
            </lang-js>
            <div #for={item of items} #key={item.id}>
                <p #for={sub of item.subs} #key={sub.id}>{foo[sub.id]}</p>
            </div>
        `)
    )

    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    expect(getForBlockSelectorInfos(forNodeContext)).toEqual([])
})

test("getForBlockSelectorInfos rejects selector expressions with extra binding refs", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let foo = { a: "x" }
            </lang-js>
            <div #for={item of items} #key={item.id}>
                {foo[(x => x)(item.id)]}
            </div>
        `)
    )

    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    expect(getForBlockSelectorInfos(forNodeContext)).toEqual([])
})

test("writeSelectorDeclaration handles shorthand refs and repeated key ranges", () => {
    // The dependency reference in the object literal shorthand cannot fall on either
    // side of the equality comparison, and is no longer taken over by the selector.
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let foo = { a: "x" }
            </lang-js>
            <div #for={item of items} #key={item.id}>
                {({ foo })[item.id] + ({ foo })[item.id]}
            </div>
        `)
    )

    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    expect(getForBlockSelectorInfos(forNodeContext)).toEqual([])

    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let selected = reactive("a")
            </lang-js>
            <div #for={item of items} #key={item.id} !class={(selected === item.id) + (selected === item.id)}></div>
        `)
    )

    const repeatedForNodeContext = getForNodeContextFromAnalyzeResult()!
    const selectorInfo = getForBlockSelectorInfos(repeatedForNodeContext).find(item => {
        return item.operation.method === "setClassName"
    })!
    const writer = new RuntimeCodeWriter(false)
    writeSelectorDeclaration(writer, selectorInfo, "getNode")
    expect(writer.code.match(/prevValue === key/g)).toHaveLength(2)
    expect(writer.code.match(/selected\.\$ === key/g)).toHaveLength(2)
})
