import type { RuntimeCodeWriter } from "../writer"
import type { Range, TemplateNode, ParsedExpression } from "#type-declarations/compiler"

import ts from "typescript"

import { decodeHTML } from "entities"
import { CodeEditor } from "../editor"
import { getRawArgumentInfo } from "../../optimizer/raw"
import { traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, generateIdentifier } from "../../state"
import { isArrayBindingNameIdentifier } from "../../ts-ast/assert"
import { getMaybeReusedString, replaceReusedStringReferences } from "../../optimizer/compress"
import { getGeneratedStaticTextContent, getParsedExpression } from "../../../util/compiler/template"

export function writeParsedExpression(
    writer: RuntimeCodeWriter,
    key: any,
    sourcemap = true,
    eliminateRaw = false,
    outsideEffect = false
) {
    const parsedExpression = getParsedExpression(key)!
    const editor = new CodeEditor(parsedExpression.source, parsedExpression.startSourceIndex)
    const overriddenRanges = transformRawCalls(
        editor,
        eliminateRaw,
        outsideEffect,
        parsedExpression
    )
    replaceReusedStringReferences(editor, parsedExpression.reusedStringReferences)
    traverseObject(parsedExpression.topLevelReferences, (key, value) => {
        const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[key]
        if (topLevelIdentifier && topLevelIdentifier.transformTo) {
            for (const reference of value) {
                if (reference.shorthand) {
                    editor.insert(reference.range[1], `: ${topLevelIdentifier.transformTo}`)
                } else if (!overriddenRanges[reference.range[0]]) {
                    editor.replace(...reference.range, topLevelIdentifier.transformTo, true)
                }
            }
        }
    })
    for (const reference of parsedExpression.contextReferences) {
        const parsedPattern = reference.pattern
        if (!isArrayBindingNameIdentifier(parsedPattern.node)) {
            continue
        }

        const parsedDirective = parsedPattern.directive
        if (!parsedDirective.context) {
            continue
        }

        const contextKey = parsedPattern === parsedDirective.patterns[0] ? "m" : "x"
        const transformed = `${parsedDirective.context.argId}.${contextKey}`
        if (reference.shorthand) {
            editor.insert(reference.range[1], `: ${transformed}`)
        } else {
            editor.replace(...reference.range, `${transformed}`, true)
        }
    }
    if (sourcemap) {
        return writer.writeEditedScript(editor)
    } else {
        return writer.write(editor.result)
    }
}

export function transformInterpolatedText(
    writer: RuntimeCodeWriter,
    node: TemplateNode,
    decodeEntities = false,
    outsideEffect = false
) {
    if (!node.content.length) {
        return getMaybeReusedString("")
    }

    let partCount = 0
    let singlePart = node.content[0]
    for (let i = 0; i < node.content.length; i++) {
        const part = node.content[i]
        if (part.isInterpolated || getGeneratedStaticTextContent(part)) {
            partCount++
            singlePart = part

            if (partCount > 1) {
                break
            }
        }
    }

    if (partCount === 1) {
        if (singlePart.isInterpolated) {
            return writeParsedExpression(writer, singlePart, true, false, outsideEffect)
        }
        const generated = getGeneratedStaticTextContent(singlePart)!
        return writer.write(
            getMaybeReusedString(decodeEntities ? decodeHTML(generated) : generated)
        )
    }

    for (let i = 0, j = 0; i < node.content.length; i++) {
        const part = node.content[i]
        if (part.isInterpolated) {
            if (!j++) {
                writer.write(getMaybeReusedString(""))
            }
            writer.write(" + (")
            writeParsedExpression(writer, part, true, false, outsideEffect).write(")")
        } else {
            const generated = getGeneratedStaticTextContent(part)
            if (!generated) {
                continue
            }
            const value = decodeEntities ? decodeHTML(generated) : generated
            if (j++) {
                writer.write(" + ")
            }
            writer.write(getMaybeReusedString(value))
        }
    }
}

function transformRawCalls(
    editor: CodeEditor,
    eliminateRaw: boolean,
    outsideEffect: boolean,
    parsedExpression: ParsedExpression
) {
    // - topLevelRefs：顶部作用域标识符引用的位置位图
    // - overridden：raw 实参中保持原始标识符（不添加 .$）的位置位图
    //
    // - topLevelRefs: a position bitmap of top-level identifier references
    // - overridden: a position bitmap of raw arguments kept as raw identifiers (without .$)
    const overridden = new Uint8Array(parsedExpression.source.length)
    const topLevelRefs = new Uint8Array(parsedExpression.source.length)
    traverseObject(parsedExpression.topLevelReferences, (_, references) => {
        for (const reference of references) {
            topLevelRefs.fill(1, reference.range[0], reference.range[1])
        }
    })
    for (const call of parsedExpression.rawCallExpressions) {
        if (call.arguments.length !== 1 || ts.isSpreadElement(call.arguments[0])) {
            continue
        }

        const arg = call.arguments[0]
        const callExp = call.expression
        const argRange: Range = [arg.getStart(), arg.getEnd()]
        const callRange: Range = [call.getStart(), call.getEnd()]
        const calleeRange: Range = [callExp.getStart(), callExp.getEnd()]

        // 引用属性 setter 中的 raw 调用直接移除
        // raw calls inside property setters are removed directly
        if (eliminateRaw) {
            editor.remove(calleeRange[0], argRange[0])
            editor.remove(argRange[1], callRange[1])
            continue
        }

        // 位图命中为顶部作用域标识符，按其状态分类；未命中统一按 "unwrap" 处理
        // A bitmap hit is a top-level scope identifier classified by its status;
        // a miss is treated uniformly as "unwrap".
        const argumentInfo = getRawArgumentInfo(call, topLevelRefs)

        // 读取原始标识符，交由 toRaw 解包
        // Reads the raw identifier and unwraps it with toRaw.
        if (argumentInfo?.kind === "unwrap") {
            overridden.fill(1, argumentInfo.range[0], argumentInfo.range[1])
            editor.replace(...calleeRange, `${generateIdentifier.internal}.toRaw`, true)
        }

        // 不带响应性能力的标识符：直接读取即可
        // Identifiers carrying no reactive capability: a plain read is enough.
        else if (argumentInfo?.kind === "plain") {
            editor.remove(calleeRange[0], argRange[0])
            editor.remove(argRange[1], callRange[1])
        }

        // derived/alias 与其余表达式：effect 外直接解包，effect 内需暂停追踪
        // derived/alias and other expressions: unwrap directly outside effects;
        // pause tracking inside effects.
        else {
            if (!outsideEffect) {
                editor.replace(
                    ...calleeRange,
                    `${generateIdentifier.internal}.noTrackingToRaw`,
                    true
                )
                editor.insert(argRange[0], "() => (")
                editor.insert(callRange[1] - 1, ")")
            } else {
                editor.replace(...calleeRange, `${generateIdentifier.internal}.toRaw`, true)
            }
        }
    }
    return overridden
}
