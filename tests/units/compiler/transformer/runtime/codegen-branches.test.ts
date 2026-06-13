import { test, expect } from "vitest"
import {
    RuntimeCodeWriter,
    IntermediateCodeWriter
} from "../../../../../src/compiler/transformer/writer"
import {
    writeContextDeclaration,
    writeContextPatterns
} from "../../../../../src/compiler/transformer/runtime/context"
import {
    writeParsedExpression,
    transformInterpolatedText
} from "../../../../../src/compiler/transformer/runtime/interpolation"
import { compile } from "../../../../../src/compiler/compile"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"
import { getLocByIndex } from "../../../../../src/util/compiler/position"
import { CodeEditor } from "../../../../../src/compiler/transformer/editor"
import { analyzeResult, inputDescriptor } from "../../../../../src/compiler/state"

function compileRuntime(source: string, debug = false) {
    const result = compile(formatSourceCode(source), { debug })
    expect(result.messages.filter(item => item.type === "error")).toEqual([])
    return result.code
}

function compileTestingSource(source: string, debug = false) {
    const result = compile(formatSourceCode(source), { debug })
    expect(result.messages.filter(item => item.type === "error")).toEqual([])
    return result
}

function getDirective(name: string) {
    for (const nodeContext of analyzeResult.template.nodeContexts.values()) {
        const directive = nodeContext.attributesMap[name]
        if (directive) {
            return directive
        }
    }
    return null
}

function getParsedExpressionKeyBySource(source: string) {
    for (const [key, parsedExpression] of analyzeResult.template.parsedExpressions.entries()) {
        if (parsedExpression.source.trim() === source) {
            return key
        }
    }
    return null
}

function getParsedExpressionEntryWithContextReference() {
    for (const entry of analyzeResult.template.parsedExpressions.entries()) {
        if (entry[1].contextReferences.length) {
            return entry
        }
    }
    return null
}

function getTextNodeByParentTag(parentTag: string) {
    for (const nodeContext of analyzeResult.template.nodeContexts.values()) {
        if (nodeContext.node.tag === "" && nodeContext.node.parent?.tag === parentTag) {
            return nodeContext.node
        }
    }
    return null
}

test("Runtime codegen: defaultRefs/defaultProps with args assign to context", () => {
    const code = compileRuntime(`
        <lang-js>
            defaultRefs({ root: null })
            defaultProps({ title: "QK" })
        </lang-js>
        <div></div>
    `)
    expect(code).toContain("_ctx.R = { root: null }")
    expect(code).toContain('_ctx.P = { title: "QK" }')
    expect(code).not.toContain("defaultRefs(")
    expect(code).not.toContain("defaultProps(")
})

test("Runtime codegen: defaultRefs/defaultProps without args do not assign context fields", () => {
    const code = compileRuntime(`
        <lang-js>
            defaultRefs()
            defaultProps()
        </lang-js>
        <div></div>
    `)
    expect(code).not.toContain("_ctx.R =")
    expect(code).not.toContain("_ctx.P =")
})

test("Runtime codegen: intrinsic usage path emits direct internal call", () => {
    const code = compileRuntime(`
        <lang-js>
            watchExp(() => 1, () => {})
        </lang-js>
        <div></div>
    `)
    expect(code).toContain("_.init(_anchor, _ctx)")
    expect(code).toContain("_.watchExp(() => 1, () => {})")
})

test("Runtime codegen: many delegated events generate wrapped event registration list", () => {
    const code = compileRuntime(`
        <button @click></button>
        <button @dblclick></button>
        <button @mousedown></button>
        <button @mouseup></button>
        <button @mousemove></button>
        <button @mouseover></button>
        <button @mouseout></button>
        <button @keydown></button>
        <button @keyup></button>
        <button @input></button>
        <button @change></button>
    `)
    expect(code).toContain("_ctx.e = [")
    expect(code).toMatch(/_ctx\.e = \[[\s\S]*\n[\s\S]*\]/)
})

test("CodeEditor: result applies remove/insert/replace and keeps index map", () => {
    compileTestingSource(`<lang-js>abcd</lang-js>`)
    const scriptStartIndex = inputDescriptor.script.loc.start.index
    const scriptCode = inputDescriptor.script.code

    const editor = new CodeEditor(scriptCode, scriptStartIndex)
    expect(editor.isEmbeddedScript).toBe(true)

    editor.remove(1, 3)
    editor.insert(1, "XY", [0, 2])
    editor.replace(3, 4, "!", true)

    expect(editor.result).toBe("aXY!")
    expect(editor.getSourceIndex(1)).toBe(scriptStartIndex)
    expect(editor.getSourceIndex(3)).toBeUndefined()
})

test("CodeEditor: insertMulti supports mixed snippet input", () => {
    compileTestingSource(`<lang-js>ab</lang-js>`)
    const editor = new CodeEditor(
        inputDescriptor.script.code,
        inputDescriptor.script.loc.start.index
    )
    editor.insertMulti(1, ["+", { value: "Z", sourceRange: [0, 1] }])
    expect(editor.result).toBe("a+Zb")
})

test("CodeEditor: intermediateResult handles additions with sourceRange", () => {
    compileTestingSource(`<lang-js>ab</lang-js>`)
    const editor = new CodeEditor(
        inputDescriptor.script.code,
        inputDescriptor.script.loc.start.index
    )
    editor.insert(1, "QQ", [0, 1])
    expect(editor.intermediateResult).toBe("aQQb")
    expect(editor.getSourceIndex(0)).toBe(inputDescriptor.script.loc.start.index)
})

test("CodeEditor: disabled source editor returns empty outputs", () => {
    compileTestingSource(`<lang-js>abc</lang-js>`)

    const editor = new CodeEditor("abc", -1)
    expect(editor.result).toBe("")
    expect(editor.intermediateResult).toBe("")
})

test("Context: declaration returns directly when directive has no parsed context", () => {
    compileTestingSource(`
        <lang-js>
            let ok = true
        </lang-js>
        <div #if={ok}></div>
    `)

    const writer = new RuntimeCodeWriter(false)
    writeContextDeclaration(writer, getDirective("#if")!)
    expect(writer.code).toBe("")
})

test("Context: non-debug identifier-only patterns skip setter declaration", () => {
    compileTestingSource(
        `
            <lang-js>
                let list = [1]
            </lang-js>
            <div #for={item of list}></div>
        `,
        false
    )

    const writer = new RuntimeCodeWriter(false)
    writeContextDeclaration(writer, getDirective("#for")!)
    expect(writer.code).toBe("")
})

test("Context: writeContextPatterns writes destructuring pattern from parsed directive", () => {
    compileTestingSource(`
        <lang-js>
            let list = [[1]]
        </lang-js>
        <div #for={[item] of list}></div>
    `)

    const writer = new RuntimeCodeWriter(false)
    const directive = getDirective("#for")!
    const parsedDirective = analyzeResult.template.parsedDirectives.get(directive)!
    writeContextPatterns(writer, parsedDirective.patterns, false, true)

    expect(writer.code).toContain("[item]")
})

test("Runtime interpolation: writeParsedExpression replaces transformed top-level references", () => {
    compileTestingSource(`
        <lang-js>
            let foo = reactive(1)
        </lang-js>
        <div>{foo + 1}</div>
    `)

    const key = getParsedExpressionKeyBySource("foo + 1")
    expect(key).toBeTruthy()

    const writer = new RuntimeCodeWriter(false)
    writeParsedExpression(writer, key)

    expect(writer.code).toContain(" + 1")
    expect(writer.code).not.toBe("foo + 1")
})

test("Runtime interpolation: writeParsedExpression rewrites context references", () => {
    compileTestingSource(`
        <lang-js>
            let list = [1]
        </lang-js>
        <div #for={item of list} #key={item}>{item}</div>
    `)

    const entry = getParsedExpressionEntryWithContextReference()
    expect(entry).toBeTruthy()
    const [key, parsedExpression] = entry!
    const contextId = parsedExpression.contextReferences[0].pattern.directive.context!.argId

    const writer = new RuntimeCodeWriter(false)
    writeParsedExpression(writer, key)

    expect(writer.code).toContain(`${contextId}.m`)
})

test("Runtime interpolation: transformInterpolatedText handles static-only text", () => {
    compileTestingSource(`<div>hello</div>`)

    const writer = new RuntimeCodeWriter(false)
    transformInterpolatedText(writer, getTextNodeByParentTag("div")!)

    expect(writer.code).toContain('"hello"')
})

test("Runtime interpolation: transformInterpolatedText joins multi parts", () => {
    compileTestingSource(`
        <lang-js>
            let foo = "x"
        </lang-js>
        <div>{foo} tail</div>
    `)

    const writer = new RuntimeCodeWriter(false)
    transformInterpolatedText(writer, getTextNodeByParentTag("div")!)

    expect(writer.code).toContain('"" + (')
    expect(writer.code).toContain(' + " tail"')
})

test("RuntimeCodeWriter: writeEditedScript covers embedded and external script branches", () => {
    compileTestingSource(`<lang-js>  x</lang-js>`)

    const writer = new RuntimeCodeWriter(false)
    writer.indent(false)

    const embeddedEditor = new CodeEditor(
        inputDescriptor.script.code,
        inputDescriptor.script.loc.start.index
    )
    writer.writeEditedScript(embeddedEditor)

    const externalEditor = new CodeEditor("a", inputDescriptor.script.loc.start.index + 2)
    writer.writeEditedScript(externalEditor)

    expect(writer.code).toContain("x")
    expect(writer.code).toContain("a")
})

test("RuntimeCodeWriter: writeTemplateStr and mappings generation", () => {
    compileTestingSource(`<lang-js>abcdef</lang-js>`)

    const writer = new RuntimeCodeWriter(true)
    writer.writeTemplateStr("hello", getLocByIndex(0, 5))

    expect(writer.code).toContain("hello")
    expect(typeof writer.mappings).toBe("string")
})

test("IntermediateCodeWriter: range write fills stoi for uncovered source span", () => {
    compileTestingSource(`<lang-js>abcdef</lang-js>`)

    const writer = new IntermediateCodeWriter()
    writer.write("X", [1, 4])

    expect(writer.code).toBe("X")
    expect(writer.indexMap.stoi[1]).toBe(0)
    expect(writer.indexMap.stoi[2]).toBe(0)
    expect(writer.indexMap.stoi[3]).toBe(0)
})

test("IntermediateCodeWriter: writeEditedScript consumes intermediate editor output", () => {
    compileTestingSource(`<lang-js>ab</lang-js>`)

    const editor = new CodeEditor(
        inputDescriptor.script.code,
        inputDescriptor.script.loc.start.index
    )
    editor.insert(1, "Q", [0, 1])

    const writer = new IntermediateCodeWriter()
    writer.writeEditedScript(editor)

    expect(writer.code).toBe("aQb")
    expect(writer.indexMap.itos.length).toBe(3)
})
