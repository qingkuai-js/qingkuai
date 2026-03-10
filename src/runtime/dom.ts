import type { NodeContext } from "#type-declarations/runtime"

import { currentDestruction } from "./state"
import { any, len } from "../util/shared/sundry"
import { isUndefined } from "../util/shared/assert"
import { DOCUMENT, NODE_CONTEXT } from "./constants"

export function newTextNode() {
    return DOCUMENT!.createTextNode("")
}

export function selectElement(selector: string) {
    return DOCUMENT!.querySelector(selector)
}

export function setText(text: Text, content: any) {
    const context = getNodeContext(text, false)
    if (((content = "" + content), context)) {
        context.a.v = content
    }
    if ((!context || context.a.d) && text.nodeValue != content) {
        text.nodeValue = content
    }
}

export function getElementValue(elem: HTMLElement) {
    return getNodeContext(elem).a?.value ?? any(elem).value
}

export function getChild(node: Element, index = 0) {
    return node.childNodes[index]
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

export function getNodeContext(elem: any, create = true): NodeContext {
    if (create) {
        elem[NODE_CONTEXT] ??= {
            a: {},
            e: {}
        }
    }
    return elem[NODE_CONTEXT]
}

// 创建一个 HTML 片段获取器，重复获取时返回原片段的克隆副本以降低开销
// Create an HTML fragment getter that returns a cloned instance
// of the original fragment on each retrieval to minimize reuse overhead
export function createFragmentGetter(html: string, arr?: string[]) {
    let fragment: DocumentFragment | undefined
    const template = DOCUMENT!.createElement("template")
    return () => {
        if (isUndefined(fragment)) {
            template.innerHTML = arr ? restoreHtmlForFragment(html, arr) : html
            fragment = template.content
            fragment.prepend(newTextNode())
        }

        const ret = fragment.cloneNode(true) as DocumentFragment
        if (currentDestruction) {
            currentDestruction.n = [ret.firstChild, ret.lastChild]
        }
        return ret
    }
}

// 将压缩后的 HTML 字符串恢复原貌
// Restore the compressed HTML string to its original form
function restoreHtmlForFragment(html: string, arr: string[], ret = "") {
    for (let i = 0; i < len(html); ) {
        if (html.charCodeAt(i) !== 47) {
            ret += html[i++]
            continue
        }

        const nextCode = html.charCodeAt(++i)
        if (nextCode === 47) {
            ret += "/"
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
