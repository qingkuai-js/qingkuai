import type {
    ASTLocation,
    TemplateNode,
    ParsedDirective,
    TemplateAttribute,
    TemplateNodeContext,
} from "#type-declarations/compiler"

import {
    walkTemplateNodes,
    getStartTagNameLoc,
    getStartTagOpenLoc,
    getParsedExpression,
    getTemplateNodeContext,
    getGeneratedStaticTextContent
} from "../../util/compiler/template"
import { SPREAD_TAG } from "../constants"
import { analyzeAttributes } from "./attribute"
import { analyzeStaticTextContent } from "./text"
import { newCleanObj } from "../../util/shared/sundry"
import { UnnecessarySpreadTag } from "../message/warn"
import { parseComponentTag } from "../parser/component"
import { objectAssign } from "../../util/shared/aliases"
import { analyzeResult, inputDescriptor } from "../state"
import { shouldBeSelectedAttrStartCharRE } from "../regular"
import { isHtmlDirectiveChild } from "../../util/compiler/assert"
import { getNonWhiteSpaceLocByLoc } from "../../util/compiler/position"
import { increaseReusedStringUsedTimes } from "../transformer/runtime/compress"
import { analyzeInterpolation, analyzeTemplateAsExpression } from "./interpolation"
import { DuplicateSlotAssignment, DuplicateSlotName, NestedSlotElement } from "../message/error"

export function analyzeTemplate(nodes: TemplateNode[]) {
    walkTemplateNodes(nodes, node => {
        let nodeContext: TemplateNodeContext
        let parentContextIdentifiers: Record<string, ParsedDirective> | undefined
        if (node.parent) {
            parentContextIdentifiers = getTemplateNodeContext(node.parent)?.contextIdentifiers
        }
        analyzeResult.template.nodeContexts.set(
            node,
            (nodeContext = {
                node,
                id: "",
                anchorId: "",
                fragment: null,
                eventListeners: [],
                sortedDirectives: [],
                staticAttributes: [],
                dynamicAttributes: [],
                referenceAttributes: [],
                selectableChildCount: 0,
                shouldBeSelected: false,
                attributesMap: newCleanObj(),
                contextIdentifiers: objectAssign(newCleanObj(), parentContextIdentifiers)
            })
        )

        if (node.componentTag) {
            const startTagLog = getStartTagNameLoc(node)
            analyzeResult.template.parsedComponentTags.set(node, parseComponentTag(node))
            analyzeTemplateAsExpression(node, node.componentTag, node, startTagLog, "component")
        }

        switch ((analyzeAttributes(node), node.tag)) {
            case "slot": {
                for (let current = node.parent; current; current = current.parent) {
                    if (current.tag === "slot") {
                        NestedSlotElement(getStartTagOpenLoc(current))
                    }
                }
                recordSlotName(node, getTemplateNodeContext(node).attributesMap.name)
                break
            }
            case "": {
                for (const part of node.content) {
                    if (!part.isInterpolated) {
                        analyzeStaticTextContent(node, part)
                    } else {
                        if (part === node.content[0]) {
                            increaseReusedStringUsedTimes("")
                        }
                        analyzeInterpolation(node, part, part.value, part.loc.start.index)
                    }
                }
                break
            }
            default: {
                if (node.tag === SPREAD_TAG) {
                    if (!node.children.length) {
                        UnnecessarySpreadTag(getStartTagOpenLoc(node), "children")
                    }
                    if (!node.parent?.componentTag && !nodeContext.sortedDirectives.length) {
                        UnnecessarySpreadTag(getStartTagOpenLoc(node), "directives")
                    }
                }
            }
        }
    })
    walkTemplateNodes(nodes, node => {
        if (node.componentTag) {
            checkSlotAssignment(node)
        }
        if (!inputDescriptor.options.checkMode) {
            evaluateTemplateNodeSelection(node)
        }
    })
}

function markTemplateNodeShouldBeSelected(node: TemplateNode) {
    const nodeContext = getTemplateNodeContext(node)
    if (!nodeContext.shouldBeSelected) {
        if (node.parent) {
            markTemplateNodeShouldBeSelected(node.parent)
        }
        if ("slot" !== node.tag && SPREAD_TAG !== node.tag && !node.componentTag) {
            nodeContext.shouldBeSelected = true
        }
    }
}

function evaluateTemplateNodeSelection(node: TemplateNode) {
    if (node.isEmbedded) {
        return
    }

    if ("" === node.tag) {
        if (isHtmlDirectiveChild(node) || node.content.some(part => part.isInterpolated)) {
            markTemplateNodeShouldBeSelected(node)
        }
        return
    }

    if ("slot" === node.tag || node.componentTag) {
        if (node.parent) {
            markTemplateNodeShouldBeSelected(node.parent)
        }
        return
    }

    if (getTemplateNodeContext(node).sortedDirectives.length) {
        if (node.parent) {
            markTemplateNodeShouldBeSelected(node.parent)
        }
    }
    if (node.attributes.some(attr => shouldBeSelectedAttrStartCharRE.test(attr.name.raw))) {
        markTemplateNodeShouldBeSelected(node)
        return
    }
}

// 检查组件一级子元素是否被分配到了相同的插槽出口
// Check whether direct child elements of a component are assigned to the same slot outlet.
function checkSlotAssignment(node: TemplateNode) {
    const existingMap: Record<string, [ASTLocation, boolean]> = newCleanObj()

    const recordExistingMap = (name: string, loc: ASTLocation) => {
        const existing = existingMap[name]
        if (((existingMap[name] = [loc, false]), existing)) {
            DuplicateSlotAssignment(loc, node.tag, name)

            if (!existing[1]) {
                existingMap[name][1] = true
                DuplicateSlotAssignment(existing[0], node.tag, name)
            }
        }
    }

    for (const child of node.children) {
        if ("" === child.tag && !willTextNodeGenerateFragment(child)) {
            continue
        }
        const directive = getTemplateNodeContext(child).attributesMap["#slot"]
        const expressionInfo = getParsedExpression(directive)
        if (expressionInfo) {
            const { startSourceIndex, node } = expressionInfo
            recordExistingMap(
                inputDescriptor.source.slice(
                    startSourceIndex + node.start! + 1,
                    startSourceIndex + node.end! - 1
                ),
                directive.loc
            )
        } else {
            recordExistingMap(
                "default",
                child.tag ? getStartTagOpenLoc(child) : getNonWhiteSpaceLocByLoc(child.loc)
            )
        }
    }
}

function recordSlotName(node: TemplateNode, attribute?: TemplateAttribute) {
    // 没有 name 属性的 slot 节点，默认插槽名称为 default
    // For a `slot` node without a `name` attribute, the default slot name is `default`.
    const name = attribute?.value.raw ?? "default"
    const existing = analyzeResult.template.slots[name]
    if (((analyzeResult.template.slots[name] = node), !existing)) {
        return
    }

    // 多个 slot 节点具有相同的 name 属性值
    // Multiple `slot` nodes share the same `name` attribute value.
    const existringAttr = getTemplateNodeContext(existing).attributesMap.name
    DuplicateSlotName(attribute?.loc ?? getStartTagOpenLoc(node), name)
    DuplicateSlotName(existringAttr?.loc ?? getStartTagOpenLoc(existing), name)
}

function willTextNodeGenerateFragment(node: TemplateNode) {
    return node.content.some(part => part.isInterpolated || getGeneratedStaticTextContent(part))
}
