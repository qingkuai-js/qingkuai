import type {
    TemplateNode,
    ParsedPattern,
    ParsedDirective,
    TemplateAttribute
} from "#type-declarations/compiler"
import type { ContextPattern } from "#type-declarations/estree"

import {
    InvalidSlotName,
    ConflictingDirectives,
    EmptyContextPattern,
    ExpectedStringLiteral,
    UnrecognizedDirective,
    MissingDirectiveValue,
    InvalidContextPattern,
    TooManyBindingPatterns,
    MissingPrecedingDirective,
    InvalidHtmlDirectivePlacement,
    InvalidKeyDirectivePlacement,
    DuplicatePromiseBlockDirectives,
    InvalidSlotDirectivePlacement,
    InvalidTargetDirectivePlacement,
    HtmlDirectiveRequiresSingleTextChild
} from "../message/error"
import {
    getLocByIndex,
    getNonWhiteSpaceLocByLoc,
    getNonWhitespaceLocByIndex
} from "../../util/compiler/position"
import { isContextPattern } from "../estree/assert"
import { markNeedSourcemap } from "../estree/sundry"
import { parseContextPattern } from "../parser/script"
import { analyzeInterpolation } from "./interpolation"
import { parseDirectiveValue } from "../parser/directive"
import { analyzeResult, inputDescriptor } from "../state"
import { ensureIdWithNumSuffix } from "../../util/compiler/sundry"
import { walkEstree, walkPatternIdentifiers } from "../estree/walk"
import { CONFLICTING_DIRECTIVES_MAP, DIRECTIVE_LIST } from "../constants"
import { RedundantDirectiveValue, UnnecessaryHtmlDirective } from "../message/warn"
import { getPrevElementContext, getTemplateNodeContext } from "../../util/compiler/template"
import { isRequiredValueDirective, shouldAnalyzeAttributeValue } from "../../util/compiler/assert"

export function analyzeDirective(node: TemplateNode, directive: TemplateAttribute) {
    let conflictingDirective: TemplateAttribute | undefined

    const nameLoc = directive.name.loc
    const rawName = directive.name.raw
    const rawValue = directive.value.raw
    const nodeContext = getTemplateNodeContext(node)
    const valueStartSourceIndex = directive.value.loc.start.index

    const localAnalyzeInterpolation = (source: string, startSourceIndex: number) => {
        return analyzeInterpolation(node, directive, source, startSourceIndex)
    }

    // 缺少指令值
    // Missing directive value.
    if (isRequiredValueDirective(rawName) && !directive.equalSign) {
        MissingDirectiveValue(directive.loc, rawName)
    }

    // 未知指令
    // Unrecognized directives.
    if (!DIRECTIVE_LIST.has(rawName)) {
        UnrecognizedDirective(nameLoc, rawName)
    }

    // 检查是否存在冲突的指令
    // Check for conflicting directives.
    if (CONFLICTING_DIRECTIVES_MAP[rawName]) {
        conflictingDirective = nodeContext.sortedDirectives.find(item => {
            return CONFLICTING_DIRECTIVES_MAP[rawName].includes(item.name.raw)
        })
    }
    if (conflictingDirective) {
        ConflictingDirectives(nameLoc, rawName, conflictingDirective.name.raw)
        ConflictingDirectives(conflictingDirective.name.loc, rawName, conflictingDirective.name.raw)
    }

    switch (rawName) {
        case "#slot": {
            if (!node.parent || !node.parent.componentTag) {
                InvalidSlotDirectivePlacement(nameLoc)
            }
            if (directive.valueEnclosure !== "none") {
                const { patterns, keywordIndex, base, baseStartSourceIndex } =
                    parseDirectiveValue(directive)!
                const parsedDirective: ParsedDirective = {
                    src: {
                        directive,
                        nodeContext
                    },
                    base,
                    keywordIndex,
                    patterns: [],
                    baseStartSourceIndex
                }
                analyzeResult.template.parsedDirectives.set(directive, parsedDirective)

                // from 关键字后方的插槽名称必须是静态字符串字面量
                // The slot name following the `from` keyword must be a static string literal.
                if (!base.trim()) {
                    ExpectedStringLiteral(getLocByIndex(baseStartSourceIndex))
                } else {
                    const expression = localAnalyzeInterpolation(base, baseStartSourceIndex)
                    if (
                        expression?.type !== "StringLiteral" &&
                        (expression?.type !== "TemplateLiteral" || expression.expressions.length)
                    ) {
                        ;(keywordIndex === -1 ? ExpectedStringLiteral : InvalidSlotName)(
                            getNonWhitespaceLocByIndex(
                                baseStartSourceIndex,
                                baseStartSourceIndex + base.length
                            )
                        )
                    }
                }

                if (patterns.length > 1) {
                    const errorLoc = getNonWhitespaceLocByIndex(
                        valueStartSourceIndex,
                        valueStartSourceIndex + keywordIndex
                    )
                    TooManyBindingPatterns(errorLoc, rawName, 1, patterns.length)
                }
                recordContextPatterns(parsedDirective, patterns)
            }
            return
        }

        case "#for": {
            if (directive.valueEnclosure !== "none") {
                const { patterns, keywordIndex, base, baseStartSourceIndex } =
                    parseDirectiveValue(directive)!
                const parsedDirective: ParsedDirective = {
                    src: {
                        directive,
                        nodeContext
                    },
                    context: {
                        returnsId: "",
                        argId: ensureIdWithNumSuffix("_ctx")
                    },
                    base,
                    keywordIndex,
                    patterns: [],
                    baseStartSourceIndex
                }
                localAnalyzeInterpolation(base, baseStartSourceIndex)
                analyzeResult.template.parsedDirectives.set(directive, parsedDirective)

                if (patterns.length > 2) {
                    const errorLoc = getNonWhitespaceLocByIndex(
                        valueStartSourceIndex,
                        valueStartSourceIndex + keywordIndex
                    )
                    TooManyBindingPatterns(errorLoc, rawName, 2, patterns.length)
                }
                recordContextPatterns(parsedDirective, patterns)
            }
            return
        }

        case "#then":
        case "#catch": {
            if (!nodeContext.attributesMap["#await"]) {
                let checkRes = false
                let prevElementContext = getPrevElementContext(node)

                const expectedList = ["#await", rawName === "#then" ? "#catch" : "#then"]
                const prevElementFirstDirective = prevElementContext?.sortedDirectives[0]
                const extraMsg =
                    prevElementContext &&
                    prevElementContext.node.parent?.componentTag &&
                    prevElementFirstDirective?.name.raw !== "#slot"
                        ? ` Note that the preceding element has an implicit "#slot" directive.`
                        : ""

                while (prevElementContext) {
                    if (prevElementContext.sortedDirectives[0]?.name.raw === "#await") {
                        if (prevElementContext.sortedDirectives[1]?.name.raw === rawName) {
                            DuplicatePromiseBlockDirectives(directive.name.loc, rawName)
                            DuplicatePromiseBlockDirectives(
                                prevElementContext.sortedDirectives[1].name.loc,
                                rawName
                            )
                        }
                        checkRes = true
                        break
                    }
                    prevElementContext = getPrevElementContext(prevElementContext.node)
                }

                if (extraMsg || !checkRes) {
                    MissingPrecedingDirective(directive.name.loc, rawName, expectedList, extraMsg)
                }
            }

            if (directive.valueEnclosure !== "none") {
                const patterns: ContextPattern[] = []
                const parseResult = parseContextPattern(rawValue)

                const reportInvalidPattern = (start: number, end: number) => {
                    InvalidContextPattern(getNonWhitespaceLocByIndex(start, end))
                }

                if (!parseResult) {
                    reportInvalidPattern(
                        valueStartSourceIndex,
                        valueStartSourceIndex + rawValue.length
                    )
                } else {
                    for (const element of parseResult.elements) {
                        if (isContextPattern(element)) {
                            patterns.push(element)
                        } else {
                            reportInvalidPattern(
                                valueStartSourceIndex + element.start!,
                                valueStartSourceIndex + element.end!
                            )
                        }
                    }
                }
                if (!patterns.length) {
                    return
                }
                if (patterns.length > 1) {
                    TooManyBindingPatterns(
                        getNonWhiteSpaceLocByLoc(directive.value.loc),
                        rawName,
                        1,
                        patterns.length
                    )
                }

                const parsedDirective: ParsedDirective = {
                    src: {
                        directive,
                        nodeContext
                    },
                    base: "",
                    patterns: [],
                    keywordIndex: -1,
                    baseStartSourceIndex: valueStartSourceIndex
                }
                recordContextPatterns(parsedDirective, patterns)
                analyzeResult.template.parsedDirectives.set(directive, parsedDirective)
            }
            return
        }

        case "#key": {
            if (!nodeContext.attributesMap["#for"]) {
                InvalidKeyDirectivePlacement(nameLoc)
            }
            break
        }

        case "#target": {
            if (node.parent && node.parent.componentTag) {
                InvalidTargetDirectivePlacement(nameLoc)
            }
            break
        }

        case "#html": {
            if (node.componentTag || "slot" === node.tag) {
                InvalidHtmlDirectivePlacement(nameLoc, node.componentTag ? "component" : "slot")
            } else if (!(node.children.length === 1 && !node.children[0].tag)) {
                HtmlDirectiveRequiresSingleTextChild(node.loc)
            } else if (
                !directive.value.raw &&
                !node.children[0].content.some(item => item.isInterpolated)
            ) {
                UnnecessaryHtmlDirective(directive.loc)
            }
            break
        }

        case "#else":
        case "#elif": {
            if (rawName === "#else" && directive.valueEnclosure !== "none") {
                RedundantDirectiveValue(directive.loc, rawName)
            }

            const expectedList = ["#if", "#elif"]
            const prevElementContext = getPrevElementContext(node)
            const prevElementFirstDirective = prevElementContext?.sortedDirectives[0]
            const extraMsg =
                prevElementContext &&
                prevElementContext.node.parent?.componentTag &&
                prevElementFirstDirective?.name.raw !== "#slot"
                    ? ` Note that the preceding element has an implicit "#slot" directive.`
                    : ""
            if (extraMsg || !expectedList.includes(prevElementFirstDirective?.name.raw ?? "")) {
                MissingPrecedingDirective(nameLoc, rawName, expectedList, extraMsg)
            }
            break
        }
    }

    if (shouldAnalyzeAttributeValue(directive)) {
        localAnalyzeInterpolation(rawValue, valueStartSourceIndex)
    }

    function recordContextPatterns(
        parsedDirective: ParsedDirective,
        patternNodes: ContextPattern[]
    ) {
        for (const patternNode of patternNodes) {
            const validIdentifiers = new Set<string>()
            const parsedPattern: ParsedPattern = {
                node: patternNode,
                directive: parsedDirective,
                declaredIdentifiers: validIdentifiers,
                sourceRange: [valueStartSourceIndex, valueStartSourceIndex]
            }
            parsedDirective.patterns.push(parsedPattern)

            if (patternNode) {
                if (inputDescriptor.options.sourcemap) {
                    walkEstree(patternNode, {
                        AnyNode(node) {
                            markNeedSourcemap(node, valueStartSourceIndex)
                        }
                    })
                }
                parsedPattern.sourceRange = [
                    valueStartSourceIndex + patternNode.start!,
                    valueStartSourceIndex + patternNode.end!
                ]
                walkPatternIdentifiers(patternNode, ({ name }) => {
                    validIdentifiers.add(name)
                    analyzeResult.script.fullIdentifiers.add(name)
                    nodeContext.contextIdentifiers[name] = parsedDirective
                })
            }
            if (patternNode && validIdentifiers.size === 0) {
                EmptyContextPattern(
                    getNonWhitespaceLocByIndex(
                        valueStartSourceIndex + patternNode.start!,
                        valueStartSourceIndex + patternNode.end!
                    )
                )
            }
        }
    }
}
