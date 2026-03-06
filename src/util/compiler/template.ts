import type { TemplateAttribute, TemplateNode, TextContentPart } from "#type-declarations/compiler"

import { getLocByIndex } from "./position"
import { isEmptyString } from "../shared/assert"
import { analyzeResult } from "../../compiler/state"
import { SPREAD_TAG } from "../../compiler/constants"
import { interpolatedAttrStartCharRE } from "../../compiler/regular"

export function getRawContent(node: TemplateNode) {
    if (!node.content.length) {
        return ""
    }
    return node.content.reduce((ret, cur) => {
        if (!cur.isInterpolated) {
            return ret + cur.value
        }
        return ret + `{${cur.value}}`
    }, "")
}

export function isBlankTextNode(node: TemplateNode) {
    return (
        isEmptyString(node.tag) &&
        node.content.length === 1 &&
        isEmptyString(node.content[0].value.trim())
    )
}

export function getPrevElementContext(node: TemplateNode) {
    while (node.prev && "" === node.prev.tag) {
        node = node.prev
    }
    return node.prev && getTemplateNodeContext(node.prev)
}

export function getNextElementContent(node: TemplateNode) {
    while (node.next && "" === node.next.tag) {
        node = node.next
    }
    return node.next && getTemplateNodeContext(node.next)
}

export function getParsedPatterns(key: any) {
    return analyzeResult.template.parsedPatterns.get(key)
}

export function getParsedExpression(key: any) {
    return analyzeResult.template.parsedExpressions.get(key)
}

export function getTemplateNodeContext(node: TemplateNode) {
    return analyzeResult.template.nodeContexts.get(node)!
}

export function getParsedEventInfo(key: TemplateAttribute) {
    return analyzeResult.template.eventInfos.get(key)
}

export function getGeneratedStaticTextContent(part: TextContentPart) {
    return analyzeResult.template.staticTextContents.get(part)
}

export function isHtmlDirectiveChild(node: TemplateNode) {
    if (!node.parent) {
        return false
    }
    return !!getTemplateNodeContext(node.parent).attributesMap["#html"]
}

// 获取元素的前置注释节点（前方的空白文本节点将被忽略）
// Get the leading comment node for a given element (ignoring the preceding blank text node)
export function getLeadingCommentNode(node: TemplateNode) {
    if (isEmptyString(node.tag)) {
        return
    }
    while (node.prev) {
        if (isBlankTextNode(node.prev)) {
            node = node.prev
            continue
        }
        return node.prev.tag === "!" ? node.prev : void 0
    }
}

// 获取父节点的标签名称，为 SPREAD_TAG 时继续向上查找，不存在时返回 undefined
// Get the tag name of parent node; if it is `SPREAD_TAG`, continue searching upward; return undefined if not exist
export function getParentTag(node: TemplateNode) {
    if (!node.parent) {
        return
    }
    if (node.parent.tag !== SPREAD_TAG) {
        return node.parent.tag
    }
    return getParentTag(node.parent)
}

// 获取 TemplateNode 开始标签起始标记（<div、<span、<input、<!--等）的源码位置信息
// Get the source location of a TemplateNode's start tag marker (e.g., <div, <span, <input, <!--)
export function getStartTagOpenLoc(node: TemplateNode) {
    const tagLength = node.tag === "!" ? 3 : node.tag.length
    return getLocByIndex(node.loc.start.index, node.loc.start.index + tagLength + 1)
}

export function getAttributeBaseNameLoc(attribute: TemplateAttribute) {
    if (!interpolatedAttrStartCharRE.test(attribute.name.raw[0])) {
        return attribute.name.loc
    }
    return getLocByIndex(attribute.name.loc.start.index, attribute.name.loc.end.index)
}

export function getStartTagLoc(node: TemplateNode) {
    return getLocByIndex(node.loc.start.index + 1, node.loc.start.index + 1 + node.tag.length)
}

export function walkTemplateNodes(nodes: TemplateNode[], callback: (node: TemplateNode) => void) {
    for (const node of nodes) {
        callback(node)
        walkTemplateNodes(node.children, callback)
    }
}
