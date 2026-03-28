import type { NodeContext } from "#type-declarations/runtime"

import { any } from "../util/shared/sundry"
import { currentDestruction } from "./state"
import { isString, isUndefined } from "../util/shared/assert"
import { DOCUMENT, NODE_CONTEXT, FRAGMENT_FLAG } from "./constants"
import { FRAG_LEADING_ANCHOR, FRAG_ORPHAN_CONTENT } from "../util/shared/flags"

export function newTextNode() {
    return DOCUMENT!.createTextNode("")
}

export function selectElement(selector: string) {
    return DOCUMENT!.querySelector(selector)
}

export function setText(text: any, content: any) {
    if (!isString(content)) {
        content = "" + content
    }
    if (content !== text[NODE_CONTEXT]) {
        text[NODE_CONTEXT] = text.nodeValue = content
    }
}

export function getElementValue(elem: HTMLElement) {
    return getNodeContext(elem).a?.value ?? any(elem).value
}

export function getChild(node: Element, index = 0) {
    if (((node as any)[FRAGMENT_FLAG] ?? 0) & FRAG_LEADING_ANCHOR) {
        index++
    }
    return node.childNodes[index]
}

export function getNodeContext(elem: any): NodeContext {
    return (elem[NODE_CONTEXT] ??= {
        a: {},
        e: {}
    })
}

export function appendChild(target: Element, node: Node) {
    target.appendChild(node)
}

export function getSibling(node: ChildNode, distance = 1) {
    while (distance--) {
        node = node.nextSibling!
    }
    return node
}

export function getChildAsText(target: Element, index = 0) {
    const textNode = newTextNode()
    const child = getChild(target, index)
    return (child.replaceWith(textNode), textNode)
}

export function insertBefore(reference: ChildNode, node: Node) {
    reference.before(node)
}

// 创建一个 HTML 片段获取器，重复获取时返回原片段的克隆副本以降低开销
// Create an HTML fragment getter that returns a cloned instance
// of the original fragment on each retrieval to minimize reuse overhead
export function createFragmentGetter(html: string, arr?: string[]) {
    let content: ChildNode | DocumentFragment | undefined
    return (flag = 0) => {
        const isOrphan = flag & FRAG_ORPHAN_CONTENT
        if (isUndefined(content)) {
            const template = DOCUMENT!.createElement("template")
            template.innerHTML = arr ? restoreHtmlForFragment(html, arr) : html

            const fragmentContent = template.content
            if (flag & FRAG_LEADING_ANCHOR) {
                ;(content = fragmentContent).prepend(newTextNode())
            } else {
                content = isOrphan ? fragmentContent.firstChild! : fragmentContent
            }
        }

        const ret = content.cloneNode(true) as any
        if (flag) {
            ret[FRAGMENT_FLAG] = flag
        }
        if (currentDestruction) {
            currentDestruction.r = ret
        }
        return ret
    }
}

// 将压缩后的 HTML 字符串恢复原貌
// Restore the compressed HTML string to its original form
function restoreHtmlForFragment(html: string, arr: string[], ret = "") {
    for (let i = 0; i < html.length; ) {
        if (html.charCodeAt(i) !== 47) {
            ret += html[i++]
            continue
        }

        const nextCode = html.charCodeAt(++i)
        if (nextCode === 47) {
            ret += "/"
            i++
            continue
        }

        let index = nextCode - 48
        let code = html.charCodeAt(++i)
        while (code >= 48 && code <= 57) {
            index = index * 10 + (code - 48)
            code = html.charCodeAt(++i)
        }
        ret += arr[index]
    }
    return ret
}
