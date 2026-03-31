import nodeFs from "node:fs"

import { test, expect } from "vitest"
import { parse } from "@babel/parser"
import { compile, compileIntermediate } from "../../../../src/compiler/compile"
import { formatSourceCode } from "../../../../src/util/testing/sundry"

const complexFileInput = nodeFs.readFileSync(new URL("./_input.qk", import.meta.url), "utf8")

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

    expect(prod.messages.filter(msg => msg.type === "error")).toEqual([])
    expect(dev.messages.filter(msg => msg.type === "error")).toEqual([])
    expectValidESMSyntax(prod.code, `${label}-prod`)
    expectValidESMSyntax(dev.code, `${label}-debug`)

    return { prod, dev }
}

function compileIntermediateAndAssertNoErrors(source: string, label: string) {
	const result = compileIntermediate(source, { typeDeclarationFilePath: "qingkuai/internal" })

	expect(result.messages.filter(msg => msg.type === "error")).toEqual([])
	expectValidESMSyntax(result.code, `${label}-intermediate`)

	return result
}

test("Runtime: complex file broad syntax coverage and generated-code sanity", () => {
	const source = complexFileInput

    const { prod, dev } = compileRuntimeAndAssertNoErrors(source, "complex-runtime")

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
    expect(prod.code).toContain("_ctx.e = [_s1]")

    expect(dev.code).toContain("_.conditionBlock([")
    expect(dev.code).toContain("_.promiseBlock(")
    expect(dev.code).toContain("_.htmlBlock(")
    expect(dev.code).toContain("_.targetBlock(")
    expect(dev.code).toContain("_.listBlock(")
    expect(dev.code).toContain("let [_showPanel, showPanel] = _.react(true, _S1)")
    expect(dev.code).toContain(
        'let [_pending, pending] = _.react(Promise.resolve({ value: "done" }), _S2)'
    )
    expect(dev.code).toContain("let [_mount, mount] = _.react(document.body, _S3)")
    expect(dev.code).toContain("let [_list, list] = _.react([")
    expect(dev.code).toContain('_ctx.e = ["click"]')

    expect(prod.code.includes("_compressStrings")).toBe(true)
    expect(dev.code.includes("_compressStrings")).toBe(false)
})

test("Runtime regression: slot fallback generates valid nullish-coalesced call syntax", () => {
	const source = formatSourceCode(`
		<lang-js>
			let label = "fallback"
		</lang-js>

		<Comp>
			<div #slot={"body"}>
				<slot name="main">
					<qk:spread>
						fallback: <em>{label}</em>
					</qk:spread>
				</slot>
			</div>
		</Comp>
	`)

    const { prod, dev } = compileRuntimeAndAssertNoErrors(source, "slot-fallback")

    expect(prod.code).toContain("?? (() => {")
    expect(dev.code).toContain("?? (() => {")
    expect(prod.code).toContain("}))(")
    expect(dev.code).toContain("}))(")
    expect(prod.code).toContain("_ctx.s?.main")
    expect(dev.code).toContain("_ctx.s?.main")
})

test("Runtime regression: component branch keeps condition block branches separated", () => {
	const source = formatSourceCode(`
		<lang-js>
			let showPanel = true
			let error = ""
		</lang-js>

		<Comp #if={showPanel}></Comp>
		<div #elif={error}>{error}</div>
		<div #else>empty panel</div>
	`)

    const { prod, dev } = compileRuntimeAndAssertNoErrors(source, "component-condition")

    expect(prod.code).toContain("_.conditionBlock([")
    expect(dev.code).toContain("_.conditionBlock([")
    expect(prod.code).toContain("Comp(")
    expect(dev.code).toContain("Comp(")
    expect(prod.code).not.toContain("})__ =>")
    expect(dev.code).not.toContain("})__ =>")
})

test("Intermediate regression: component slot blocks generate valid object property closures", () => {
    const source = formatSourceCode(`
        <lang-js>
            let label = "fallback"
        </lang-js>

        <Comp>
            <div #slot={"body"}>
                <slot name="main">
                    <qk:spread>
                        fallback: <em>{label}</em>
                    </qk:spread>
                </slot>
            </div>
        </Comp>
    `)

    const result = compileIntermediateAndAssertNoErrors(source, "slot-closure")

    expect(result.code).toContain('"body": () => {')
    expect(result.code).toContain("},")
    expect(result.code).not.toContain("};,")
    expect(result.slotNames).toEqual(["main"])
})

test("Intermediate regression: component branch input stays parseable in intermediate output", () => {
    const source = formatSourceCode(`
        <lang-js>
            let showPanel = true
            let error = ""
        </lang-js>

        <Comp #if={showPanel}></Comp>
        <div #elif={error}>{error}</div>
        <div #else>empty panel</div>
    `)

    const result = compileIntermediateAndAssertNoErrors(source, "component-condition")

    expect(result.code).toContain("if (showPanel) {}")
    expect(result.code).toContain("if (error) {}")
    expect(result.code).toContain("__qk__lsu.confirmComponent(Comp)")
    expect(result.code).not.toContain("}error;")
})

test("Intermediate: complex file broad syntax coverage and metadata sanity", () => {
    const result = compileIntermediateAndAssertNoErrors(complexFileInput, "complex")
    const mainSlotNode = result.getSlotTemplateNode("main")

    expect(result.code).toContain('import { __qk__lsu')
    expect(result.code).toContain('from "qingkuai/internal"')
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
