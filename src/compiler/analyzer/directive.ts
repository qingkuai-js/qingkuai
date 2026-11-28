import type TS from "typescript";

import type {
    TemplateNode,
    ParsedPattern,
    ParsedDirective,
    NonPrimaryAnchor,
    TemplateAttribute,
    TemplateNodeContext,
} from "#type-declarations/compiler";

import ts from "../ts-api";

import {
    TestingMode,
    PositionFlag,
    AttributeValueEnclosure,
    HtmlDirectivePlacementKind,
} from "../enums";
import {
    InvalidSlotName,
    ConflictingDirectives,
    EmptyContextPattern,
    ExpectedStringLiteral,
    UnrecognizedDirective,
    MissingDirectiveValue,
    InvalidContextPattern,
    ShadowedChainDirective,
    TooManyBindingPatterns,
    MissingPrecedingDirective,
    DuplicateContextIdentifier,
    InvalidKeyDirectivePlacement,
    UsedForbiddenIdentifierFormat,
    InvalidHtmlDirectivePlacement,
    InvalidSlotDirectivePlacement,
    InvalidScopeDirectivePlacement,
    InvalidTargetDirectivePlacement,
    DuplicatePromiseBlockDirectives,
    HtmlDirectiveRequiresSingleTextChild,
} from "../message/error";
import {
    getLocByIndex,
    markPositionFlag,
    getNonWhiteSpaceLocByLoc,
    getNonWhitespaceLocByIndex,
} from "../../util/compiler/position";
import {
    RedundantDirectiveValue,
    UnnecessaryHtmlDirective,
    UnnecessaryScopeDirective,
    ScopeDirectiveHasActualAncestor,
} from "../message/warn";
import {
    DIRECTIVE_LIST,
    PRESERVED_IDPREFIX,
    CONFLICTING_DIRECTIVES_MAP,
    CHAIN_CONTINUATION_DIRECTIVES,
} from "../constants";
import { markNeedSourcemap } from "../ts-ast/sundry";
import { getLastElem } from "../../util/shared/arrays";
import { parseContextPattern } from "../parser/script";
import { analyzeInterpolation } from "./interpolation";
import { isValidContextPattern } from "../ts-ast/assert";
import { parseDirectiveValue } from "../parser/directive";
import { analyzeResult, inputDescriptor } from "../state";
import { ensureIdWithNumSuffix } from "../../util/compiler/sundry";
import { walkBindingNameIdentifiers, walkTsNode } from "../ts-ast/walk";
import { getPrevElementContext, getTemplateNodeContext } from "../../util/compiler/template";
import { isRequiredValueDirective, shouldAnalyzeAttributeValue } from "../../util/compiler/assert";

export function analyzeDirective(node: TemplateNode, directive: TemplateAttribute) {
    let shadowed = false;
    let conflictingDirective: TemplateAttribute | undefined;

    const nameLoc = directive.name.loc;
    const rawName = directive.name.raw;
    const rawValue = directive.value.raw;
    const nodeContext = getTemplateNodeContext(node);
    const valueStartSourceIndex = directive.value.loc.start.index;

    const localAnalyzeInterpolation = (source: string, startSourceIndex: number) => {
        return analyzeInterpolation(node, directive, source, startSourceIndex);
    };

    // 缺少指令值
    // Missing directive value.
    if (isRequiredValueDirective(rawName) && !directive.equalSign) {
        MissingDirectiveValue(directive.loc, rawName);
    }

    // 未知指令
    // Unrecognized directives.
    if (!DIRECTIVE_LIST.has(rawName)) {
        UnrecognizedDirective(nameLoc, rawName);
    }

    // 检查是否存在冲突的指令
    // Check for conflicting directives.
    if (CONFLICTING_DIRECTIVES_MAP[rawName]) {
        conflictingDirective = nodeContext.sortedDirectives.find(item => {
            return CONFLICTING_DIRECTIVES_MAP[rawName].includes(item.name.raw);
        });
    }
    if (conflictingDirective) {
        ConflictingDirectives(nameLoc, rawName, conflictingDirective.name.raw);
        ConflictingDirectives(
            conflictingDirective.name.loc,
            rawName,
            conflictingDirective.name.raw,
        );
    }

    // 检查链式指令是否被遮蔽
    // Check if the chain directive is shadowed.
    if (!conflictingDirective && CHAIN_CONTINUATION_DIRECTIVES.has(rawName)) {
        const directiveAbove = getLastElem(nodeContext.sortedDirectives);
        if (directiveAbove) {
            if (
                (rawName !== "#then" && rawName !== "#catch") ||
                directiveAbove.name.raw !== "#await"
            ) {
                shadowed = true;
                ShadowedChainDirective(nameLoc, rawName, directiveAbove.name.raw);
            }
        } else if (node.parent?.componentTag) {
            shadowed = true;
            ShadowedChainDirective(nameLoc, rawName, "#slot", true);
        }
    }

    switch (rawName) {
        case "#slot": {
            if (!node.parent || !node.parent.componentTag) {
                InvalidSlotDirectivePlacement(nameLoc);
            }
            if (directive.valueEnclosure !== AttributeValueEnclosure.None) {
                const { patterns, keywordIndex, base, baseStartSourceIndex } =
                    parseDirectiveValue(directive)!;
                const parsedDirective: ParsedDirective = {
                    src: {
                        directive,
                        nodeContext,
                    },
                    base,
                    keywordIndex,
                    patterns: [],
                    baseStartSourceIndex,
                };
                analyzeResult.template.parsedDirectives.set(directive, parsedDirective);

                // from 关键字后方的插槽名称必须是静态字符串字面量
                // The slot name following the `from` keyword must be a static string literal.
                if (!base.trim()) {
                    ExpectedStringLiteral(getLocByIndex(baseStartSourceIndex));
                } else {
                    const expression = localAnalyzeInterpolation(base, baseStartSourceIndex);
                    if (
                        !expression ||
                        !(
                            ts.isStringLiteral(expression) ||
                            ts.isNoSubstitutionTemplateLiteral(expression)
                        )
                    ) {
                        (keywordIndex === -1 ? ExpectedStringLiteral : InvalidSlotName)(
                            getNonWhitespaceLocByIndex(
                                baseStartSourceIndex,
                                baseStartSourceIndex + base.length,
                            ),
                        );
                    }
                }

                if (patterns.length > 1) {
                    const errorLoc = getNonWhitespaceLocByIndex(
                        valueStartSourceIndex,
                        valueStartSourceIndex + keywordIndex,
                    );
                    TooManyBindingPatterns(errorLoc, rawName, 1, patterns.length);
                }
                recordContextPatterns(parsedDirective, patterns);
            }
            return;
        }

        case "#for": {
            if (directive.valueEnclosure !== AttributeValueEnclosure.None) {
                const { patterns, keywordIndex, base, baseStartSourceIndex } =
                    parseDirectiveValue(directive)!;
                for (const patternNode of patterns) {
                    if (!ts.isOmittedExpression(patternNode)) {
                        walkBindingNameIdentifiers(patternNode.name, identifier => {
                            analyzeResult.script.fullIdentifiers.add(identifier.text);
                        });
                    }
                }

                const parsedDirective: ParsedDirective = {
                    src: {
                        directive,
                        nodeContext,
                    },
                    context: {
                        argId: ensureIdWithNumSuffix("_ctx"),
                    },
                    base,
                    keywordIndex,
                    patterns: [],
                    baseStartSourceIndex,
                };
                localAnalyzeInterpolation(base, baseStartSourceIndex);
                analyzeResult.template.parsedDirectives.set(directive, parsedDirective);

                if (patterns.length > 2) {
                    const errorLoc = getNonWhitespaceLocByIndex(
                        valueStartSourceIndex,
                        valueStartSourceIndex + keywordIndex,
                    );
                    TooManyBindingPatterns(errorLoc, rawName, 2, patterns.length);
                }
                recordContextPatterns(parsedDirective, patterns);
            }
            return;
        }

        case "#then":
        case "#catch": {
            if (!shadowed && !nodeContext.attributesMap["#await"]) {
                let couldContinueChain = false;
                const prevElementContext = getPrevElementContext(node);
                const prevRawName = prevElementContext?.sortedDirectives[0]?.name.raw;
                const prevInPlaceRawName = prevElementContext?.sortedDirectives[1]?.name.raw;
                const prevHasInPlace =
                    prevInPlaceRawName === "#then" || prevInPlaceRawName === "#catch";
                const expectedList = rawName === "#then" ? ["#await"] : ["#await", "#then"];
                if (prevRawName === "#await" && prevInPlaceRawName === rawName) {
                    DuplicatePromiseBlockDirectives(directive.name.loc, rawName);
                    DuplicatePromiseBlockDirectives(
                        prevElementContext!.sortedDirectives[1].name.loc,
                        rawName,
                    );
                } else {
                    couldContinueChain =
                        rawName === "#then"
                            ? prevRawName === "#await" && !prevHasInPlace
                            : prevRawName === "#then" ||
                              (prevRawName === "#await" && prevInPlaceRawName !== "#catch");
                    if (!couldContinueChain) {
                        MissingPrecedingDirective(
                            directive.name.loc,
                            rawName,
                            expectedList,
                            getNonPrimaryPrecedingAnchor(expectedList, prevElementContext),
                        );
                    }
                }
                if (couldContinueChain) {
                    nodeContext.exclusiveChain ??= prevElementContext?.exclusiveChain ?? node;
                }
            }

            if (directive.valueEnclosure !== AttributeValueEnclosure.None) {
                const patterns: TS.ArrayBindingElement[] = [];
                const parseResult = parseContextPattern(rawValue, valueStartSourceIndex);

                const reportInvalidPattern = (start: number, end: number) => {
                    InvalidContextPattern(getNonWhitespaceLocByIndex(start, end));
                };

                if (!parseResult) {
                    reportInvalidPattern(
                        valueStartSourceIndex,
                        valueStartSourceIndex + rawValue.length,
                    );
                } else {
                    for (const element of parseResult.elements) {
                        if (isValidContextPattern(element)) {
                            patterns.push(element);
                        } else {
                            reportInvalidPattern(
                                valueStartSourceIndex + element.getStart(),
                                valueStartSourceIndex + element.getEnd(),
                            );
                        }
                    }
                }
                if (!patterns.length) {
                    return;
                }
                if (patterns.length > 1) {
                    TooManyBindingPatterns(
                        getNonWhiteSpaceLocByLoc(directive.value.loc),
                        rawName,
                        1,
                        patterns.length,
                    );
                }

                const parsedDirective: ParsedDirective = {
                    src: {
                        directive,
                        nodeContext,
                    },
                    base: "",
                    patterns: [],
                    keywordIndex: -1,
                    baseStartSourceIndex: valueStartSourceIndex,
                };
                recordContextPatterns(parsedDirective, patterns);
                analyzeResult.template.parsedDirectives.set(directive, parsedDirective);
            }
            return;
        }

        case "#key": {
            if (!nodeContext.attributesMap["#for"]) {
                InvalidKeyDirectivePlacement(nameLoc);
            }
            break;
        }

        case "#target": {
            if (node.parent && node.parent.componentTag) {
                InvalidTargetDirectivePlacement(nameLoc);
            }
            break;
        }

        case "#scope": {
            if (directive.equalSign) {
                RedundantDirectiveValue(directive.loc, rawName);
            }
            if (!node.componentTag) {
                InvalidScopeDirectivePlacement(nameLoc);
            } else if (node.hasActualAncestor) {
                ScopeDirectiveHasActualAncestor(nameLoc);
            } else if (
                inputDescriptor.options.testing !== TestingMode.E2e &&
                !inputDescriptor.styles.some(style => !style.global)
            ) {
                UnnecessaryScopeDirective(directive.loc);
            }
            break;
        }

        case "#html": {
            if (node.componentTag || "slot" === node.tag) {
                InvalidHtmlDirectivePlacement(
                    nameLoc,
                    node.componentTag
                        ? HtmlDirectivePlacementKind.Component
                        : HtmlDirectivePlacementKind.Slot,
                );
            } else if (!(node.children.length === 1 && !node.children[0].tag)) {
                HtmlDirectiveRequiresSingleTextChild(node.loc);
            } else if (
                !directive.value.raw &&
                !node.children[0].content.some(item => item.isInterpolated)
            ) {
                UnnecessaryHtmlDirective(directive.loc);
            }
            break;
        }

        case "#else":
        case "#elif": {
            if (rawName === "#else" && directive.valueEnclosure !== AttributeValueEnclosure.None) {
                RedundantDirectiveValue(directive.loc, rawName);
            }
            if (!shadowed) {
                const expectedList = ["#if", "#elif"];
                const prevElementContext = getPrevElementContext(node);
                const prevElementFirstDirective = prevElementContext?.sortedDirectives[0];
                const couldContinueChain = expectedList.includes(
                    prevElementFirstDirective?.name.raw ?? "",
                );
                if (!couldContinueChain) {
                    MissingPrecedingDirective(
                        nameLoc,
                        rawName,
                        expectedList,
                        getNonPrimaryPrecedingAnchor(expectedList, prevElementContext),
                    );
                }
                if (couldContinueChain) {
                    nodeContext.exclusiveChain ??= prevElementContext?.exclusiveChain ?? node;
                }
            }
            break;
        }

        case "#if":
        case "#await": {
            nodeContext.exclusiveChain ??= node;
            break;
        }
    }

    if (shouldAnalyzeAttributeValue(directive)) {
        localAnalyzeInterpolation(rawValue, valueStartSourceIndex);
    }

    // 在前置元素除最高优先级指令外的其余指令中查找期望的前驱指令；
    // 找到时返回该指令名和前置元素的最高优先级指令名，供缺前置提示说明链为何接不上
    //
    // Looks for the expected preceding directive among the directives of the preceding element other
    // than its highest-priority one; when found, returns its name and the highest-priority directive
    // name so the missing-preceding message can explain why the chain cannot continue from it.
    function getNonPrimaryPrecedingAnchor(
        expectedList: string[],
        prevElementContext: TemplateNodeContext | null,
    ): NonPrimaryAnchor | undefined {
        const directives = prevElementContext?.sortedDirectives;
        if (!directives?.length) {
            return;
        }

        const primaryDirective = directives[0];
        const anchor = directives.find(item => {
            return item !== primaryDirective && expectedList.includes(item.name.raw);
        });
        if (anchor) {
            return {
                anchor: anchor.name.raw,
                primary: primaryDirective.name.raw,
            };
        }
    }

    function recordContextPatterns(
        parsedDirective: ParsedDirective,
        patternNodes: TS.ArrayBindingElement[],
    ) {
        let reportedEmptyPattern = false;
        const declaredNames = new Set<string>();
        for (const patternNode of patternNodes) {
            const validIdentifiers = new Set<string>();
            const parsedPattern: ParsedPattern = {
                node: patternNode,
                directive: parsedDirective,
                declaredIdentifiers: validIdentifiers,
                sourceRange: [valueStartSourceIndex, valueStartSourceIndex],
            };
            parsedDirective.patterns.push(parsedPattern);

            if (!ts.isOmittedExpression(patternNode)) {
                if (inputDescriptor.options.sourcemap) {
                    walkTsNode(patternNode, node => {
                        markNeedSourcemap(node, valueStartSourceIndex);
                    });
                }
                parsedPattern.sourceRange = [
                    valueStartSourceIndex + patternNode.getStart(),
                    valueStartSourceIndex + patternNode.getEnd(),
                ];
                walkBindingNameIdentifiers(patternNode.name, identifier => {
                    const text = identifier.text;
                    const end = identifier.getEnd();
                    const start = identifier.getStart();
                    if (text.startsWith(PRESERVED_IDPREFIX)) {
                        UsedForbiddenIdentifierFormat(
                            getLocByIndex(
                                valueStartSourceIndex + start,
                                valueStartSourceIndex + end,
                            ),
                        );
                    }
                    if (declaredNames.has(text)) {
                        DuplicateContextIdentifier(
                            getLocByIndex(
                                valueStartSourceIndex + start,
                                valueStartSourceIndex + end,
                            ),
                            text,
                            rawName,
                        );
                    } else {
                        declaredNames.add(text);
                    }
                    markPositionFlag(
                        PositionFlag.ContextIdentifier,
                        valueStartSourceIndex + start,
                        valueStartSourceIndex + end,
                    );
                    validIdentifiers.add(text);
                    analyzeResult.script.fullIdentifiers.add(text);
                    nodeContext.contextIdentifiers[text] = parsedDirective;
                });

                if (validIdentifiers.size === 0) {
                    EmptyContextPattern(
                        getNonWhitespaceLocByIndex(
                            valueStartSourceIndex + patternNode.getStart(),
                            valueStartSourceIndex + patternNode.getEnd(),
                        ),
                    );
                    reportedEmptyPattern = true;
                }
            }
        }
        if (
            !reportedEmptyPattern &&
            parsedDirective.patterns.length &&
            !parsedDirective.patterns.some(pattern => pattern.declaredIdentifiers.size)
        ) {
            const patternEndIndex =
                parsedDirective.keywordIndex === -1
                    ? valueStartSourceIndex + rawValue.length
                    : valueStartSourceIndex + parsedDirective.keywordIndex;
            EmptyContextPattern(getNonWhitespaceLocByIndex(valueStartSourceIndex, patternEndIndex));
        }
    }
}
