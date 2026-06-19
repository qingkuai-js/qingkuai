import { setAttribute } from "./internal"
import { any } from "../util/shared/sundry"
import { arrayFrom } from "../util/shared/arrays"
import { isElement } from "../util/runtime/assert"
import { isString, isUndefined } from "../util/shared/assert"
import { currentDestruction, currentInstance } from "./state"
import { DOCUMENT, NODE_CONTEXT, FRAGMENT_FLAG, ATTRIBUTE_PREFIX } from "./constants"
import { FRAG_LEADING_ANCHOR, FRAG_ORPHAN_CONTENT, FRAGMENT_ROOT } from "../util/shared/flags"

export function newTextNode() {
    return DOCUMENT!.createTextNode("")
}

export function getParentElement(node: Node) {
    return node.parentElement
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

export function getSiblingAsText(node: ChildNode, distance = 1) {
    const textNode = newTextNode()
    const child = getSibling(node, distance)
    return (child.replaceWith(textNode), textNode)
}

export function getElementValue(elem: Element) {
    return any(elem)[ATTRIBUTE_PREFIX + "value"] ?? any(elem).value
}

export function getChild(node: Element, index = 0) {
    if (((node as any)[FRAGMENT_FLAG] ?? 0) & FRAG_LEADING_ANCHOR) {
        index++
    }

    let child = node.firstChild as ChildNode
    while (index-- > 0) {
        child = child.nextSibling as ChildNode
    }
    return child
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
        if (flag & FRAGMENT_ROOT) {
            attachScopesToRoot(ret)
        }
        if (flag) {
            ret[FRAGMENT_FLAG] = flag
        }
        if (currentDestruction) {
            if (isOrphan) {
                currentDestruction.s = ret
                currentDestruction.n = ret
            } else {
                currentDestruction.s = ret.firstChild
                currentDestruction.n = ret.lastChild
            }
            currentDestruction.f = flag
        }
        return ret
    }
}

// 将压缩后的 HTML 字符串恢复原貌
// Restore the compressed HTML string to its original form
function restoreHtmlForFragment(html: string, arr: string[], ret = "") {
    for (let i = 0; i < html.length; ) {
        if (html.charCodeAt(i) !== 124) {
            ret += html[i++]
            continue
        }

        const nextCode = html.charCodeAt(++i)
        if (nextCode === 124) {
            ret += "|"
            i++
            continue
        }

        if (nextCode < 48 || nextCode > 57) {
            ret += "|"
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

// 将祖先 scope 链中的所有 scope 属性设置到根元素上
// Apply all scope attributes from the ancestor scope chain to root elements
function attachScopesToRoot(node: Element | DocumentFragment): void {
    const scopes = currentInstance?.context.a
    if (!scopes?.length) {
        return
    }
    for (const element of isElement(node) ? [node] : arrayFrom(node.children)) {
        for (const scope of scopes) {
            setAttribute(element, scope, "")
        }
    }
}
