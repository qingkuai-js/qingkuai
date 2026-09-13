import type TS from "typescript"

import type {
    Range,
    ASTLocation,
    TemplateNode,
    ContextReference,
    ParsedExpression,
    TopLevelReferences,
    TemplateNodeContext
} from "#type-declarations/compiler"

import ts from "typescript"

import {
    InvalidExpression,
    ExpectedExpression,
    InvalidComponentTag,
    RawReadRequiresArgument,
    RawReadRequiresCallForm,
    RawReadRequiresSingleArgument,
    InvalidShorthandAttributeName,
    InvalidIntrinsicMethodPlacement
} from "../message/error"
import {
    getLocByIndex,
    markPositionFlag,
    getNonWhitespaceLocByIndex
} from "../../util/compiler/position"
import {
    getParsedDirective,
    getParsedExpression,
    getTemplateNodeContext
} from "../../util/compiler/template"
import {
    isRawCallExpression,
    isMemberAccessExpression,
    isIdentifierAssignmentTarget
} from "../ts-ast/assert"
import {
    markNeedSourcemap,
    getStriptTypeOperationsNode,
    getStriptTypeOperationsParent
} from "../ts-ast/sundry"
import { PositionFlag } from "../enums"
import { parseExpression } from "../parser/script"
import { newCleanObj } from "../../util/shared/sundry"
import { kebab2Camel } from "../../util/compiler/string"
import { RedundantNestedRawCall } from "../message/warn"
import { getAttributeBaseName } from "../../util/compiler/sundry"
import { walkTsNode, walkTsNodeWithContext } from "../ts-ast/walk"
import { analyzeResult, inputDescriptor, messages } from "../state"
import { collectReusedStringReference } from "../optimizer/compress"
import { endSemicolonRE, intrinsicMethodsRE, intrinsicVariableRE } from "../regular"

// 分析插值表达式：此方法会将成功解析的语法树节点缓存进 parsedExpressions
// Analyze interpolations: this method caches successfully parsed AST nodes into `parsedExpressions`.
export function analyzeInterpolation(
    templateNode: TemplateNode,
    parsingInfoKey: any,
    source: string,
    startSourceIndex: number
) {
    if (!source.trim()) {
        return ExpectedExpression(getLocByIndex(startSourceIndex))
    }

    let parsedExpression: ParsedExpression | undefined

    const attrRawName = parsingInfoKey?.name?.raw
    const reactiveContextReferences: ContextReference[] = []
    const nodeContext = getTemplateNodeContext(templateNode)
    const topLevelReferences: TopLevelReferences = newCleanObj()
    const expression = parseExpression(source, startSourceIndex)
    const isReferenceAttr = attrRawName?.startsWith("&") && nodeContext.attributesMap[attrRawName]

    if (expression) {
        parsedExpression = {
            source,
            reactive: false,
            node: expression,
            startSourceIndex,
            topLevelReferences,
            rawCallExpressions: [],
            reusedStringReferences: [],
            contextReferences: reactiveContextReferences
        }
        analyzeResult.template.parsedExpressions.set(parsingInfoKey, parsedExpression)
    } else {
        InvalidExpression(
            getNonWhitespaceLocByIndex(startSourceIndex, startSourceIndex + source.length),
            endSemicolonRE.test(source)
                ? "Expression with ending semicolon will be treated as statement, which is not allowed in interpolation."
                : ""
        )
        return null
    }

    walkTsNodeWithContext(expression, node => {
        markNeedSourcemap(node, startSourceIndex)
        collectReusedStringReference(node, parsedExpression.reusedStringReferences)

        // 通过模板中对顶级作用域标识符不同的使用方式确定其响应式状态
        // Determine the reactive status of top-level scope identifiers
        // based on their different usage patterns in the template.
        if (ts.isIdentifier(node)) {
            const idName = node.text
            const nodeRange: Range = [node.getStart(), node.getEnd()]
            const parsedDirective = nodeContext.contextIdentifiers[idName]
            const sourceRange = nodeRange.map(n => n + startSourceIndex) as Range
            const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[idName]
            const untracked = isInRawArgument(parsedExpression.rawCallExpressions, nodeRange)
            if (
                !parsedDirective &&
                !topLevelIdentifier &&
                node.isBindingReference &&
                intrinsicMethodsRE.test(idName)
            ) {
                if (idName === "raw") {
                    const parent = getStriptTypeOperationsParent(node)
                    if (
                        parent &&
                        ts.isCallExpression(parent) &&
                        getStriptTypeOperationsNode(parent.expression) === node
                    ) {
                        recordTemplateRawCall(parsedExpression, parent)
                    } else {
                        RawReadRequiresCallForm(getLocByIndex(...sourceRange))
                    }
                } else {
                    InvalidIntrinsicMethodPlacement(getLocByIndex(...sourceRange), idName)
                }
            }
            if (node.isBindingReference && !parsedDirective) {
                if (intrinsicVariableRE.test(idName)) {
                    analyzeResult.script.usedIntrinsics.add(idName)
                }
                if (topLevelIdentifier) {
                    if (!untracked) {
                        const status = topLevelIdentifier.status
                        if (
                            // prettier-ignore
                            status === "pending" ||
                            (
                                status === "literal" &&
                                (isReferenceAttr || isIdentifierAssignmentTarget(node))
                            )
                        ) {
                            for (const exp of topLevelIdentifier.usedExpressions) {
                                exp.reactive = true
                            }
                            topLevelIdentifier.status = inputDescriptor.options.reactivityMode
                        }
                        topLevelIdentifier.usedExpressions.add(parsedExpression)
                    }
                    ;(topLevelReferences[idName] ??= []).push({
                        declared: true,
                        range: nodeRange,
                        shorthand: ts.isShorthandPropertyAssignment(node.parent),
                        untracked
                    })
                }
            }
            if (
                parsedDirective &&
                node.isBindingReference &&
                shouldContextIdentifierBeTransformed(idName, parsingInfoKey, nodeContext)
            ) {
                const pattern = parsedDirective.patterns.find(parsedPattern => {
                    return parsedPattern.declaredIdentifiers.has(idName)
                })!
                reactiveContextReferences.push({
                    pattern,
                    range: nodeRange,
                    shorthand: ts.isShorthandPropertyAssignment(node)
                })
            }
            analyzeResult.script.fullIdentifiers.add(idName)

            // 以下四种情况可以判断该插值表达式具有响应性；raw 参数子树内的读取不计入
            // The following four cases determine that the interpolation is reactive,
            // except for reads inside the argument subtree of a `raw` call.
            if (untracked) {
                return
            }

            // 1. 访问 `props`、`refs` 或 `contexts`
            // 1. Accessing `props`, `refs`, or `contexts`.
            if (idName === "props" || idName === "refs" || idName === "contexts") {
                parsedExpression.reactive ||= true
            }

            // 2. 访问顶部作用域标识符且其状态不是 `literal` 或 `pending`
            // 2. Accessing a top-level scope identifier whose status is not `literal` or `pending`.
            if (
                topLevelIdentifier &&
                topLevelIdentifier.status !== "literal" &&
                topLevelIdentifier.status !== "pending"
            ) {
                parsedExpression.reactive ||= true
            }

            // 3. 访问导入标识符且该访问了其属性
            // 3. Accessing an imported identifier whose property is accessed.
            if (
                node.isBindingReference &&
                analyzeResult.script.importIdentifiers.has(idName) &&
                isMemberAccessExpression(getStriptTypeOperationsParent(node)!)
            ) {
                parsedExpression.reactive ||= true
            }

            // 4. 访问指令上下文标识符，且该指令上下文标识符所在的指令具有响应式表达式
            // 4. Accessing a directive context identifier whose directive has reactive expressions.
            if (parsedDirective && getParsedExpression(parsedDirective.src.directive)?.reactive) {
                parsedExpression.reactive ||= true
            }
        }
    })
    return expression
}

export function analyzeTemplateAsExpression(
    node: TemplateNode,
    name: string,
    parsingKey: any,
    loc: ASTLocation,
    type: "component" | "attribute"
) {
    const baseName = getAttributeBaseName(name)
    const source = type === "attribute" ? kebab2Camel(baseName) : baseName
    const expression = analyzeInterpolation(
        node,
        parsingKey,
        source,
        loc.start.index + +(type === "attribute")
    )

    // 检查模式下无需再报 “无效表达式” 的错误，转而报下方的 “无效组件名称” 或 “无效属性名称” 错误
    // In check mode, there is no need to report the "Invalid Expression" error again,
    // but instead report the "Invalid Component Name" or "Invalid Shorthand Attribute Name" error below.
    if (!expression && inputDescriptor.options.checkMode) {
        messages.pop()
    }

    if (type === "attribute") {
        if (!expression || !ts.isIdentifier(expression)) {
            return InvalidShorthandAttributeName(loc, name)
        }
    } else if (
        !expression ||
        (!ts.isIdentifier(expression) && !ts.isPropertyAccessExpression(expression))
    ) {
        return InvalidComponentTag(loc, name)
    }

    const nameSub = baseName.length - source.length
    if (nameSub > 0) {
        const parsedExpression = getParsedExpression(parsingKey)!
        inputDescriptor.positions[loc.start.index + source.length + 1].flag &=
            ~PositionFlag.SourcemapEnd
        markPositionFlag(PositionFlag.SourcemapEnd, loc.end.index)
        parsedExpression.source = " ".repeat(nameSub) + parsedExpression.source
    }
}

// #key 指令中访问 #for 指令声明的标识符不需要转换
// Identifiers declared by the `#for` directive accessed in the `#key` directive do not need to be transformed.
function shouldContextIdentifierBeTransformed(
    identifierName: string,
    parsingInfoKey: any,
    nodeContext: TemplateNodeContext
) {
    const keyDirective = nodeContext.attributesMap["#key"]
    if (!keyDirective || parsingInfoKey !== keyDirective) {
        return true
    }

    const forDirective = nodeContext.attributesMap["#for"]
    const parsedForDirective = forDirective && getParsedDirective(forDirective)
    if (!parsedForDirective) {
        return true
    }

    return !parsedForDirective.patterns.some(parsedPattern => {
        return parsedPattern.declaredIdentifiers.has(identifierName)
    })
}

// 判断标识符是否位于某个 raw 调用的参数子树内（此时其读取不计为模板访问）
// Determine whether the identifier lies inside the argument subtree of a raw call
// (its read does not count as a template access).
function isInRawArgument(rawCallExpressions: TS.CallExpression[], range: Range) {
    return rawCallExpressions.some(call => {
        if (call.arguments.length !== 1 || ts.isSpreadElement(call.arguments[0])) {
            return false
        }

        const arg = call.arguments[0]
        return range[0] >= arg.getStart() && range[1] <= arg.getEnd()
    })
}

// 记录模板插值中的 raw(expr) 非追踪读取调用，并校验调用形式与嵌套冗余；
// Record untracked reads `raw(expr)` in template interpolations,
// validating the call forms and nested redundancy.
function recordTemplateRawCall(parsedExpression: ParsedExpression, call: TS.CallExpression) {
    const args = call.arguments
    const startSourceIndex = parsedExpression.startSourceIndex
    const calleeLoc = getLocByIndex(
        startSourceIndex + call.expression.getStart(),
        startSourceIndex + call.expression.getEnd()
    )
    if (args.length === 0) {
        RawReadRequiresArgument(calleeLoc)
        return
    }
    if (args.length > 1 || ts.isSpreadElement(args[0])) {
        RawReadRequiresSingleArgument(calleeLoc)
        return
    }

    // 扫描参数子树检查是否嵌套使用了 raw
    // Scan the argument subtree for nested raw calls.
    let nestedCallee: TS.Identifier | undefined
    walkTsNode(args[0], node => {
        if (isRawCallExpression(node) && ts.isIdentifier(node.expression)) {
            nestedCallee = node.expression
            return true
        }
    })
    if (nestedCallee) {
        RedundantNestedRawCall(
            getLocByIndex(
                startSourceIndex + nestedCallee.getStart(),
                startSourceIndex + nestedCallee.getEnd()
            )
        )
    }
    parsedExpression.rawCallExpressions.push(call)
}
