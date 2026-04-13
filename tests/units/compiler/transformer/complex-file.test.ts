import { test, expect } from "vitest"
import { parse } from "@babel/parser"

import complexFileInput from "./_input"
import { compile, compileIntermediate } from "../../../../src/compiler/compile"

function expectValidESMSyntax(code: string, label: string) {
    expect(() =>
        parse(code, {
            sourceType: "module",
            sourceFilename: `qingkuai-${label}.mjs`
        })
    ).not.toThrow()
}

function compileRuntimeAndAssertNoErrors(source: string, label: string) {
    const prod = compile(source, { debug: false })
    const dev = compile(source, { debug: true })
    expectValidESMSyntax(prod.code, `${label}-prod`)
    expectValidESMSyntax(dev.code, `${label}-debug`)
    expect(dev.messages.filter(msg => msg.type === "error")).toEqual([])
    expect(prod.messages.filter(msg => msg.type === "error")).toEqual([])
    return { prod, dev }
}

function compileIntermediateAndAssertNoErrors(source: string, label: string) {
    const result = compileIntermediate(source)
    expect(result.messages.filter(msg => msg.type === "error")).toEqual([])
    expectValidESMSyntax(result.code, `${label}-intermediate`)
    return result
}

test("Runtime: complex file broad syntax coverage and generated-code sanity", () => {
    const { prod, dev } = compileRuntimeAndAssertNoErrors(complexFileInput, "complex-runtime")
    const prodClickLiteralId = prod.code.match(/const\s+(_s\d+)\s*=\s*"click"/)?.[1]

    expect(prod.code).toContain('import * as _ from "qingkuai/internal"')
    expect(dev.code).toContain('import * as _ from "qingkuai/internal"')
    expect(prod.code).toContain("_.conditionBlock([")
    expect(prod.code).toContain("_.promiseBlock(")
    expect(prod.code).toContain("_.htmlBlock(")
    expect(prod.code).toContain("_.targetBlock(")
    expect(prod.code).toContain("_.listBlock(")
    expect(prod.code).toContain("header: (_anchor1, ctx) => {")
    expect(prod.code).toContain("body: (_anchor2) => {")
    expect(prod.code).toContain("let showPanel = _.react(true)")
    expect(prod.code).toContain('let pending = _.react(Promise.resolve({ value: "done" }))')
    expect(prod.code).toContain("let mount = _.react(document.body)")
    expect(prod.code).toContain("let list = _.react([")
    expect(prodClickLiteralId).toBeTruthy()
    expect(prod.code).toContain(`_ctx.e = [${prodClickLiteralId}]`)

    expect(dev.code).toContain("_.conditionBlock([")
    expect(dev.code).toContain("_.promiseBlock(")
    expect(dev.code).toContain("_.htmlBlock(")
    expect(dev.code).toContain("_.targetBlock(")
    expect(dev.code).toContain("_.listBlock(")
    expect(dev.code).toContain("let [_showPanel, showPanel] = _.react(true, _S1)")
    expect(dev.code).toContain(
        'let [_pending, pending] = _.react(Promise.resolve({ value: "done" }), _S2)'
    )
    expect(dev.code).toMatch(/let \[_mount, mount\] = _\.react\(document\.body, _S\d+\)/)
    expect(dev.code).toContain("let [_list, list] = _.react([")
    expect(dev.code).toContain('_ctx.e = ["click"]')

    expect(prod.code.includes("_compressStrings")).toBe(true)
    expect(dev.code.includes("_compressStrings")).toBe(false)
})

test("Runtime regression: slot fallback generates valid nullish-coalesced call syntax", () => {
    const { prod, dev } = compileRuntimeAndAssertNoErrors(complexFileInput, "slot-fallback")
    expect(prod.code).toContain("?? (() => {")
    expect(dev.code).toContain("?? (() => {")
    expect(prod.code).toContain("}))(")
    expect(dev.code).toContain("}))(")
    expect(prod.code).toContain("_ctx.s?.main")
    expect(dev.code).toContain("_ctx.s?.main")
})

test("Runtime regression: component branch keeps condition block branches separated", () => {
    const { prod, dev } = compileRuntimeAndAssertNoErrors(complexFileInput, "component-condition")
    expect(prod.code).toContain("_.conditionBlock([")
    expect(dev.code).toContain("_.conditionBlock([")
    expect(prod.code).toContain("Comp(")
    expect(dev.code).toContain("Comp(")
    expect(prod.code).not.toContain("})__ =>")
    expect(dev.code).not.toContain("})__ =>")
})

test("Runtime regression: qk spread promise branches select dynamic nodes from local fragments", () => {
    const source = `
<lang-js>
    let pending = Promise.resolve({ label: "Spread resolved", extra: "OK" })
</lang-js>

<div>
    <qk:spread #await={pending}>
        waiting
        <span>pending</span>
    </qk:spread>
    <qk:spread #then={{ label, extra }}>
        then
        <span>{label}</span>
        <strong>{extra}</strong>
    </qk:spread>
</div>`

    const { prod, dev } = compileRuntimeAndAssertNoErrors(source, "spread-promise-selectors")

    expect(prod.code).toMatch(/const _span\d+ = _\.getChild\(_fragment\d+(?:, \d+)?\)/)
    expect(prod.code).toMatch(/const _strong\d+ = _\.getSibling\(_span\d+(?:, \d+)?\)/)
    expect(prod.code).not.toMatch(/const _span\d+ = _\.getChild\(_div\d+/)

    expect(dev.code).toMatch(/const _span\d+ = _\.getChild\(_fragment\d+(?:, \d+)?\)/)
    expect(dev.code).toMatch(/const _strong\d+ = _\.getSibling\(_span\d+(?:, \d+)?\)/)
    expect(dev.code).not.toMatch(/const _span\d+ = _\.getChild\(_div\d+/)
})

test("Runtime regression: keyed list selection emits selector helper and event call", () => {
    const { prod, dev } = compileRuntimeAndAssertNoErrors(complexFileInput, "keyed-selector")
    expect(prod.code).toMatch(/const _selector\d+ = \(\(\) => \{/)
    expect(prod.code).toMatch(/const _getNodeByKey\d+ = _\.keyedListBlock\(/)
    expect(prod.code).toContain("const prevNode = _getNodeByKey")
    expect(prod.code).toContain("const node = _getNodeByKey")
    expect(prod.code).toContain("if (key !== prevValue) {")
    expect(prod.code).toContain("_.renderEffect(() => {")
    expect(prod.code).toContain("_selector1(selected.$)")
    expect(prod.code).toContain("if (prevNode) {")
    expect(prod.code).toContain('_.setClassName(prevNode, prevValue === key ? "danger" : "")')
    expect(prod.code).toContain("if (node) {")
    expect(prod.code).toMatch(
        /_\.setClassName\(node, [^\n]*selected\.\$ === key \? "danger" : ""\)/
    )
    expect(prod.code).not.toContain("_selector1(_ctx")

    expect(dev.code).not.toMatch(/const _selector\d+ = \(\(\) => \{/)
    expect(dev.code).not.toContain("_selector1(_selected.$)")
    expect(dev.code).toContain("_selected.$ ===")
    expect(dev.code).toContain('"danger" : ""')
})

test("Runtime regression: debug mode skips selector optimization", () => {
    const { prod, dev } = compileRuntimeAndAssertNoErrors(complexFileInput, "debug-skip-selector")
    expect(prod.code).toMatch(/const _selector\d+ = \(\(\) => \{/)
    expect(prod.code).toMatch(/const _getNodeByKey\d+ = _\.keyedListBlock\(/)
    expect(prod.code).toContain("_.renderEffect(() => {")
    expect(prod.code).toContain("selected.$")

    expect(dev.code).not.toMatch(/const _selector\d+ = \(\(\) => \{/)
    expect(dev.code).not.toMatch(/const _getNodeByKey\d+ = _\.keyedListBlock\(/)
    expect(dev.code).not.toContain("_selector1(_selected.$)")
    expect(dev.code).toContain("_selected.$ ===")
    expect(dev.code).toContain('"danger" : ""')
})

test("Intermediate regression: component slot blocks generate valid object property closures", () => {
    const result = compileIntermediateAndAssertNoErrors(complexFileInput, "slot-closure")
    expect(result.code).toContain('"body": () => {')
    expect(result.code).toContain("},")
    expect(result.code).not.toContain("};,")
    expect(result.slotNames).toEqual(["main"])
})

test("Intermediate regression: component branch input stays parseable in intermediate output", () => {
    const result = compileIntermediateAndAssertNoErrors(complexFileInput, "component-condition")
    expect(result.code).toContain("if (showPanel) {}")
    expect(result.code).toContain("if (error) {}")
    expect(result.code).toContain("__qk__lsu.confirmComponent(Comp)")
    expect(result.code).not.toContain("}error;")
})

test("Intermediate: complex file broad syntax coverage and metadata sanity", () => {
    const result = compileIntermediateAndAssertNoErrors(complexFileInput, "complex")
    const mainSlotNode = result.getSlotTemplateNode("main")

    expect(result.code).toContain("import { __qk__lsu")
    expect(result.code).toContain('from "qingkuai/language-service"')
    expect(result.code).toContain('Readonly<Record<"main", boolean>>')
    expect(result.code).toContain("__qk__lsu.confirmComponent(Comp)")
    expect(result.code).toContain('__qk__lsu.validateEventHandler("click", onHeaderClick);')
    expect(result.code).toContain("__qk__lsu.validateTargetDirectiveValue(mount);")
    expect(result.code).toContain("const [item, index] = __qk__lsu.getListPair(list);")
    expect(result.code).toContain("pending.then((res) => {")
    expect(result.code).toContain("__qk__lsu.validateHtmlBlockOptions(rawHtml);")
    expect(result.code).toContain("rawText;")
    expect(result.code).toContain("id;")

    expect(result.slotNames).toEqual(["main"])
    expect(result.identifierStatusInfo).toMatchObject({
        title: "raw",
        showPanel: "reactive",
        pending: "reactive",
        mount: "reactive",
        list: "reactive",
        onHeaderClick: "raw",
        onItemClick: "raw"
    })
    expect(result.getTypeDelayInterIndexes).toEqual([])
    expect(result.templateNodes.length).toBeGreaterThan(0)
    expect(mainSlotNode?.tag).toBe("slot")
    expect(result.getTemplateNodeContext(mainSlotNode!).attributesMap.name?.value.raw).toBe("main")
    expect(result.getSourceIndex(0)).toBe(-1)
    expect(result.getInterIndex(0)).toBe(-1)
})
