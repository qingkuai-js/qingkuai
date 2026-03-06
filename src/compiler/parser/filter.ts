import type { TemplateNode } from "#type-declarations/compiler"

import { inputDescriptor } from "../state"
import { isEmptyString } from "../../util/shared/assert"
import { templateConditionalCommentRE } from "../regular"
import { BLOCK_TAGS, DISALLOWED_TAGS } from "../constants"
import { InvalidTemplateStructure, UsedDisallowedTag } from "../message/error"
import { getParentTag, getStartTagOpenLoc } from "../../util/compiler/template"
import { isBlankTextNode } from "../../util/compiler/assert"

export function filterTemplateNodes(node: TemplateNode): boolean {
    if (DISALLOWED_TAGS.has(node.tag)) {
        return (UsedDisallowedTag(getStartTagOpenLoc(node), node.tag), false)
    }
    if (node.tag === "!") {
        return (
            inputDescriptor.options.preserveCommentNodes ||
            templateConditionalCommentRE.test(node.children[0]?.content[0]?.value ?? "")
        )
    }
    return !inputDescriptor.options.checkTemplateStructure || shouldNodeBePreserved(node)
}

// 检查节点是否应该被保留：有些不符合 HTML 规范的标签嵌套可能会被修复，导致渲染出的 DOM 结构与预期不符
// 例如：对于未被 <table> 包裹的 <tbody> 标签，浏览器客户端可能为其自动创建一个父节点或干脆移除它
//
// Check whether a node should be preserved: some invalid HTML tag nestings may be automatically fixed,
// which can result in a DOM structure that does not match the expectation.
// For example: a <tbody> tag not wrapped in a <table> may have a parent node automatically
// created by the browser client, or the tag may be removed altogether.
function shouldNodeBePreserved(node: TemplateNode): boolean {
    let arcn = node // Ancestor Rules Check Node

    const tag = node.tag
    const parentTag = getParentTag(node) || ""
    const startTagOpenLoc = getStartTagOpenLoc(node)

    const invalidTags = (() => {
        switch (parentTag) {
            case "li": {
                return ["li"]
            }
            case "td":
            case "th": {
                return ["td", "th"]
            }
        }
    })()

    const expectedParentTags = (() => {
        switch (tag) {
            case "td":
            case "th": {
                return ["tr"]
            }
            case "thead":
            case "tbody":
            case "tfoot":
            case "caption":
            case "colgroup": {
                return ["table"]
            }
            case "col": {
                return ["colgroup"]
            }
            case "tr": {
                return ["thead", "tbody", "tfoot"]
            }
        }
    })()

    const expectedTags = (() => {
        switch (parentTag) {
            case "table": {
                return [
                    "caption",
                    "colgroup",
                    "tbody",
                    "thead",
                    "tfoot",
                    "style",
                    "script",
                    "template"
                ]
            }
            case "option": {
                return [""]
            }
            case "optgroup": {
                return ["option"]
            }
            case "colgroup": {
                return ["col", "template"]
            }
            case "thead":
            case "tbody":
            case "tfoot": {
                return ["tr", "style", "script", "template"]
            }
            case "tr": {
                return ["th", "td", "style", "script", "template"]
            }
            case "select": {
                return ["", "option", "optgroup", "hr", "script", "template"]
            }
        }
    })()

    // 当前节点的祖先标签规则：
    // 第一个数组表示：如果节点的某个祖先标签包含在其中，则应从解析结果中移除此节点；
    // 第二个数组（可选）表示：当遇到这些祖先标签时，节点被视为合法，停止继续向上遍历，不再检查更高层级的祖先。
    //
    // Ancestor tag rules for current node:
    // The first array: if any ancestor tag is included, the node should be removed from the parsing result;
    // The second array (optional): if any ancestor tag is included, the node is considered valid, and upward
    // traversal stops without checking higher ancestors.
    const ancestorRules = (() => {
        switch (tag) {
            case "a":
            case "form":
            case "button": {
                return [[tag]]
            }
            case "rt":
            case "rp": {
                return [["rt", "rp"]]
            }
            case "dt":
            case "dd": {
                return [["dt", "dd"], ["dl"]]
            }
            case "h1":
            case "h2":
            case "h3":
            case "h4":
            case "h5":
            case "h6": {
                return [["h1", "h2", "h3", "h4", "h5", "h6"]]
            }
            default: {
                return BLOCK_TAGS.has(tag) ? [["p"]] : void 0
            }
        }
    })()

    if (ancestorRules) {
        while (arcn.parent) {
            if (ancestorRules[1]?.includes(arcn.parent.tag)) {
                break
            }
            if (ancestorRules[0].includes(arcn.parent.tag)) {
                InvalidTemplateStructure(
                    startTagOpenLoc,
                    `the <${tag}> tag cannot be descendant of <${arcn.parent.tag}>`
                )
                return false
            }
            arcn = arcn.parent
        }
    }
    if (
        invalidTags?.includes(tag) ||
        (expectedParentTags && !expectedParentTags.includes(parentTag)) ||
        (expectedTags && !expectedTags.includes(tag) && !isBlankTextNode(node))
    ) {
        let msg = `the <${tag}> tag cannot be nested in <${parentTag}>`
        if (expectedParentTags) {
            msg += expectedParentTags.reduce(
                (ret, cur, index) => {
                    if (isEmptyString(cur)) {
                        cur = "#text"
                    } else {
                        cur = `<${cur}>`
                    }
                    if (expectedParentTags.length === 1) {
                        return ret + cur
                    }
                    if (index === expectedParentTags.length - 1) {
                        return `${ret} or ${cur}`
                    }
                    return `${ret}${index ? ", " : ""}${cur}`
                },
                `, it can only be nested in ${expectedParentTags.length === 1 ? "" : "these tags: "}`
            )
        }
        return (InvalidTemplateStructure(startTagOpenLoc, msg), false)
    }
    return true
}
