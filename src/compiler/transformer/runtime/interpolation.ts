import type { RuntimeCodeWriter } from "../writer"
import type { Range, TemplateNode, ParsedExpression } from "#type-declarations/compiler"

import ts from "typescript"

import { decodeHTML } from "entities"
import { CodeEditor } from "../editor"
import { traverseObject } from "../../../util/shared/sundry"
import { getRawToRawArgumentRange } from "../../optimizer/raw"
import { analyzeResult, generateIdentifier } from "../../state"
import { isArrayBindingNameIdentifier } from "../../ts-ast/assert"
import { getMaybeReusedString, replaceReusedStringReferences } from "../../optimizer/compress"
import { getGeneratedStaticTextContent, getParsedExpression } from "../../../util/compiler/template"

export function writeParsedExpression(
    writer: RuntimeCodeWriter,
    key: any,
    sourcemap = true,
    eliminateRaw = false,
    allowEliminate = true
) {
    const parsedExpression = getParsedExpression(key)!
    const editor = new CodeEditor(parsedExpression.source, parsedExpression.startSourceIndex)
    const overriddenRanges = transformRawCalls(
        editor,
        eliminateRaw,
        allowEliminate,
        parsedExpression
    )
    replaceReusedStringReferences(editor, parsedExpression.reusedStringReferences)
    traverseObject(parsedExpression.topLevelReferences, (key, value) => {
        const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[key]
        if (topLevelIdentifier && topLevelIdentifier.transformTo) {
            for (const reference of value) {
                if (reference.shorthand) {
                    editor.insert(reference.range[1], `: ${topLevelIdentifier.transformTo}`)
                } else if (!overriddenRanges.has(rangeKeyOf(reference.range))) {
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
    decodeEntities = false
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
            return writeParsedExpression(writer, singlePart)
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
            writeParsedExpression(writer, part, true, false, false).write(")")
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

function rangeKeyOf(range: Range) {
    return `${range[0]}-${range[1]}`
}

function transformRawCalls(
    editor: CodeEditor,
    eliminateRaw: boolean,
    allowEliminate: boolean,
    parsedExpression: ParsedExpression
) {
    const overridden = new Set<string>()
    for (const call of parsedExpression.rawCallExpressions) {
        if (call.arguments.length !== 1 || ts.isSpreadElement(call.arguments[0])) {
            continue
        }

        const arg = call.arguments[0]
        const argRange: Range = [arg.getStart(), arg.getEnd()]
        const callRange: Range = [call.getStart(), call.getEnd()]
        const calleeRange: Range = [call.expression.getStart(), call.expression.getEnd()]
        if (eliminateRaw || (allowEliminate && parsedExpression.node === call)) {
            // 消除：整块 raw 的读取都在 renderEffect 外求值（或赋值目标必须是普通左值），
            // raw 包裹无运行时意义
            // Eliminate: reads of a whole-block raw are evaluated outside renderEffects
            // (or the position is an assignment target requiring a plain lvalue), so the
            // raw wrapper has no runtime meaning.
            editor.remove(calleeRange[0], argRange[0])
            editor.remove(argRange[1], callRange[1])
        } else {
            const toRawRange = getRawToRawArgumentRange(call)
            if (toRawRange) {
                overridden.add(rangeKeyOf(toRawRange))
                editor.replace(...calleeRange, `${generateIdentifier.internal}.toRaw`, true)
            } else {
                editor.replace(...calleeRange, `${generateIdentifier.internal}.noTracking`, true)
                editor.insert(argRange[0], "() => (")
                editor.insert(callRange[1] - 1, ")")
            }
        }
    }
    return overridden
}
