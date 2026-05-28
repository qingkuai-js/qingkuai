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
                let foo = { a: "x" }
            </lang-js>
            <div #for={item of items} #key={item.id}>
                {foo[item.id]}
                <div class="a b" !class={foo[item.id]} !title={foo[item.id]}></div>
                <use !xlink:href={foo[item.id]}></use>
                <select !value={foo[item.id]}></select>
            </div>
        `)
    )
    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    const infos = getForBlockSelectorInfos(forNodeContext)
    expect(infos.some(item => item.operation.method === "setText")).toBe(true)
    expect(infos.some(item => item.operation.method === "setClassName")).toBe(true)
    expect(infos.some(item => item.operation.method === "setXlinkAttribute")).toBe(true)
    expect(
        infos.some(
            item => item.operation.method === "setAttribute" && item.operation.attrName === "title"
        )
    ).toBe(true)

    // !value on <select> is intentionally excluded from selector optimization.
    expect(
        infos.some(
            item => item.operation.method === "setAttribute" && item.operation.attrName === "value"
        )
    ).toBe(false)
})

test("hasSelectorForAttribute and hasSelectorForTextNode work with compiled selector infos", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let foo = { a: "x" }
            </lang-js>
            <div #for={item of items} #key={item.id}>
                {foo[item.id]}
                <div !title={foo[item.id]}></div>
                <select !value={foo[item.id]}></select>
            </div>
        `)
    )
    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    const infos = getForBlockSelectorInfos(forNodeContext)

    const textInfo = infos.find(item => item.operation.method === "setText")!
    expect(hasSelectorForTextNode(infos, textInfo.targetNodeContext)).toBe(true)

    const titleInfo = infos.find(
        item => item.operation.method === "setAttribute" && item.operation.attrName === "title"
    )!
    expect(
        hasSelectorForAttribute(infos, titleInfo.targetNodeContext, titleInfo.targetAttribute!)
    ).toBe(true)

    const selectNodeContext = Array.from(analyzeResult.template.nodeContexts.values()).find(
        item => item.node.tag === "select"
    )
    const selectValueAttr = selectNodeContext?.dynamicAttributes.find(attr => {
        return attr.name.raw === "!value"
    })

    expect(selectNodeContext).toBeTruthy()
    expect(selectValueAttr).toBeTruthy()
    expect(hasSelectorForAttribute(infos, selectNodeContext!, selectValueAttr!)).toBe(false)
})

test("writeSelectorDeclaration emits update wrapper from compiled selector info", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let foo = { a: "x" }
            </lang-js>
            <div #for={item of items} #key={item.id}>
                {foo[item.id]}
            </div>
        `)
    )
    const forNodeContext = getForNodeContextFromAnalyzeResult()!
    const selectorInfo = getForBlockSelectorInfos(forNodeContext).find(item => {
        return item.operation.method === "setText"
    })!
    const writer = new RuntimeCodeWriter(false)
    writeSelectorDeclaration(writer, selectorInfo, "getNode")
    expect(writer.code).toContain(`const ${selectorInfo.id} = (() => {`)
    expect(writer.code).toContain("const prevNode = getNode(prevValue)")
    expect(writer.code).toContain("const node = getNode(key)")
    expect(writer.code).toContain("setText(prevNode")
    expect(writer.code).toContain("setText(node")
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
            expectedEmpty: false
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
            expect(infos.some(item => item.operation.method === "setText")).toBe(true)
        }
    }
})

test("getForBlockSelectorInfos ignores dynamic attributes without parsable expression", () => {
    compile(
        formatSourceCode(`
            <lang-js>
                let items = [{ id: "a" }]
                let foo = { a: "x" }
            </lang-js>
            <div #for={item of items} #key={item.id}>
                <div !title></div>
                <div !title={foo[item.id]}></div>
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
    const selectorInfo = getForBlockSelectorInfos(forNodeContext).find(item => {
        return item.operation.method === "setText"
    })!
    const writer = new RuntimeCodeWriter(false)
    writeSelectorDeclaration(writer, selectorInfo, "getNode")
    expect(writer.code).toContain("foo: prevValue")
    expect(writer.code).toContain("foo")
    expect(writer.code).toContain("[key]")
})
