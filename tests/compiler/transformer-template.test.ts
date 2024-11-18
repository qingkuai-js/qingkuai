import { expect, test } from "vitest"
import { parseTemplate } from "../../compiler/parser/template"
import { analyzeTemplate } from "../../compiler/analyzer/template"
import { transformTemplate } from "../../compiler/transformer/template"
import { analyzeScript } from "../../compiler/analyzer/script"

// 将模版源码直接转换为输出字符串的方法
function compileTemplate(source: string) {
    const templateNodes = parseTemplate(source)
    const templateAnalysisRet = analyzeTemplate(templateNodes)
    return transformTemplate(templateAnalysisRet)
}

// 提前模拟分析script源码，主要用来标记一些响应式变量
analyzeScript(`let a = 1; const ca = rea("");`)

test("single tag", () => {
    const templateStr = compileTemplate(`
        <div></div>
    `)
    expect(templateStr).toBe(`[["div", ""]]`)
})

test("single tag with single child", () => {
    const templateStr = compileTemplate(`
        <div>
            <span></span>
        </div>
    `)
    expect(templateStr).toBe(`[["div", "", nil, nil, ["span", ""]]]`)
})

test("single tag with multiple children", () => {
    const templateStr = compileTemplate(`
        <div>
            <span></span>
            <p></p>
        </div>
    `)
    expect(templateStr).toBe(`[["div", "", nil, nil, ["span", ""], ["p", ""]]]`)
})

test("single tag with content, ", () => {
    let templateStr = compileTemplate("<div> ... </div>")
    expect(templateStr).toBe(`[["div", "..."]]`)

    templateStr = compileTemplate(`<div>{a}</div>`)
    expect(templateStr).toBe(`[["div", _ => a.$]]`)

    templateStr = compileTemplate(`<div> {a} {ca} </div>`)
    expect(templateStr).toBe(`[["div", _ => a.$ + " " + ca]]`)
})
