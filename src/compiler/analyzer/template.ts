import type { ASTLocation, TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import { analyzeAttributes } from "./attribute"
import { newCleanObj } from "../../util/shared/sundry"
import { analyzeInterpolation } from "./interpolation"
import { analyzeResult, inputDescriptor } from "../state"
import { increaseCommonStringCount } from "../../util/compiler/sundry"
import { DuplicateSlotAssignment, DuplicateSlotName } from "../message/error"
import { getStartTagOpenLoc, walkTemplateNodes } from "../../util/compiler/template"

export function analyzeTemplate(nodes: TemplateNode[]) {
    const { nodeInfos } = analyzeResult.template
    walkTemplateNodes(nodes, node => {
        let parentContextIdentifiers: Set<string> | undefined
        if (node.parent) {
            parentContextIdentifiers = nodeInfos.get(node.parent)?.contextIdentifiers
        }
        nodeInfos.set(node, {
            sortedDirectives: [],
            attributesMap: newCleanObj(),
            contextIdentifiers: new Set(parentContextIdentifiers)
        })
        if ((analyzeAttributes(node), "slot" === node.tag)) {
            recordSlotName(node, nodeInfos.get(node)!.attributesMap.name)
        }
        if ("" === node.tag) {
            for (const item of node.content) {
                if (!item.isInterpolated) {
                    increaseCommonStringCount(item.value)
                } else {
                    analyzeInterpolation(node, node.content, item.value, item.loc.start.index)
                }
            }
        }
    })
    walkTemplateNodes(nodes, node => node.componentTag && checkSlotAssignment(node))
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

        const { nodeInfos, parsedExpressions } = analyzeResult.template
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
    const nodeInfos = analyzeResult.template.nodeInfos
    const existringAttr = nodeInfos.get(existing)!.attributesMap.name
    DuplicateSlotName(attribute?.loc ?? getStartTagOpenLoc(node), name)
    DuplicateSlotName(existringAttr?.loc ?? getStartTagOpenLoc(existing), name)
}
