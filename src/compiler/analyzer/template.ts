import type {
    ASTLocation,
    TemplateNode,
    TemplateAttribute,
    TemplateNodeContext
} from "#type-declarations/compiler"

import { SPREAD_TAG } from "../constants"
import { analyzeAttributes } from "./attribute"
import { analyzeStaticTextContent } from "./text"
import { newCleanObj } from "../../util/shared/sundry"
import { analyzeInterpolation } from "./interpolation"
import { UnnecessarySpreadTag } from "../message/warn"
import { analyzeResult, inputDescriptor } from "../state"
import { increaseCompressStringUsedTimes } from "../../util/compiler/sundry"
import { DuplicateSlotAssignment, DuplicateSlotName } from "../message/error"
import { getStartTagOpenLoc, walkTemplateNodes } from "../../util/compiler/template"

export function analyzeTemplate(nodes: TemplateNode[]) {
    const { nodeContexts } = analyzeResult.template
    walkTemplateNodes(nodes, node => {
        let nodeContext: TemplateNodeContext
        let parentContextIdentifiers: Set<string> | undefined
        if (node.parent) {
            parentContextIdentifiers = nodeContexts.get(node.parent)?.contextIdentifiers
        }
        nodeContexts.set(
            node,
            (nodeContext = {
                id: "",
                anchorId: "",
                fragment: null,
                sortedDirectives: [],
                attributesMap: newCleanObj(),
                contextIdentifiers: new Set(parentContextIdentifiers)
            })
        )

        switch ((analyzeAttributes(node), node.tag)) {
            case "slot": {
                recordSlotName(node, nodeContexts.get(node)!.attributesMap.name)
                break
            }
            case "": {
                for (const part of node.content) {
                    if (!part.isInterpolated) {
                        analyzeStaticTextContent(node, part)
                    } else {
                        analyzeInterpolation(node, node.content, part.value, part.loc.start.index)
                    }
                }
                break
            }
            default: {
                if (node.tag === SPREAD_TAG) {
                    if (!node.children.length) {
                        UnnecessarySpreadTag(getStartTagOpenLoc(node), "children")
                    }
                    if (!nodeContext.sortedDirectives.length) {
                        UnnecessarySpreadTag(getStartTagOpenLoc(node), "directives")
                    }
                }
                if (!node.componentTag && !node.isEmbedded) {
                    increaseCompressStringUsedTimes(`<${node.tag}`)
                    node.isSelfClosing || increaseCompressStringUsedTimes(`</${node.tag}>`)
                }
            }
        }
        if (nodeContext.sortedDirectives.length) {
            increaseCompressStringUsedTimes("<!>")
        }
    })
    walkTemplateNodes(nodes, node => {
        if (node.componentTag) {
            checkSlotAssignment(node)
        }
    })
}

// 检查组件一级子元素是否被分配到了相同的插槽出口
// Check whether direct child elements of a component are assigned to the same slot outlet.
function checkSlotAssignment(node: TemplateNode) {
    const existingMap: Record<string, ASTLocation> = newCleanObj()

    const recordExistingMap = (name: string, loc: ASTLocation) => {
        const existing = existingMap[name]
        if (((existingMap[name] = loc), existing)) {
            DuplicateSlotAssignment(loc, node.componentTag, name)
            DuplicateSlotAssignment(existing, node.componentTag, name)
        }
    }

    for (const child of node.children) {
        if ("" === child.tag) {
            continue
        }

        const { nodeContexts: nodeInfos, parsedExpressions } = analyzeResult.template
        const directive = nodeInfos.get(child)!.attributesMap["#slot"]
        const expressionInfo = parsedExpressions.get(directive)
        if (expressionInfo) {
            const { startSourceIndex, node } = expressionInfo[0]
            recordExistingMap(
                inputDescriptor.source.slice(
                    startSourceIndex + node.start! + 1,
                    startSourceIndex + node.end! - 1
                ),
                directive.loc
            )
        } else {
            recordExistingMap("default", getStartTagOpenLoc(child))
        }
    }
}

function recordSlotName(node: TemplateNode, attribute?: TemplateAttribute) {
    // 没有 name 属性的 slot 节点，默认插槽名称为 default
    // For a `slot` node without a `name` attribute, the default slot name is `default`.
    const name = attribute?.value.raw ?? "default"
    const existing = analyzeResult.slots[name]
    if (((analyzeResult.slots[name] = node), !existing)) {
        return
    }

    // 多个 slot 节点具有相同的 name 属性值
    // Multiple `slot` nodes share the same `name` attribute value.
    const nodeInfos = analyzeResult.template.nodeContexts
    const existringAttr = nodeInfos.get(existing)!.attributesMap.name
    DuplicateSlotName(attribute?.loc ?? getStartTagOpenLoc(node), name)
    DuplicateSlotName(existringAttr?.loc ?? getStartTagOpenLoc(existing), name)
}
