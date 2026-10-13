import { any } from "../util/shared/sundry"
import { arrayFrom } from "../util/shared/arrays"
import { isElement } from "../util/runtime/assert"
import { currentDestruction, currentInstance } from "./state"
import { isNumber, isString, isUndefined } from "../util/shared/assert"
import { DOCUMENT, NODE_CONTEXT, FRAGMENT_FLAG, ATTRIBUTE_PREFIX } from "./constants"
import { FRAG_LEADING_ANCHOR, FRAG_ORPHAN_CONTENT, FRAGMENT_ROOT } from "../util/shared/flags"

const VALUE_CACHE_KEY = ATTRIBUTE_PREFIX + "value"

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
    if (!isString(content) && !isNumber(content)) {
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

// 挂载收集器把一个连续渲染区间的内容先在文档外组装，再一次性插入文档。
// 典型用途是列表挂载：逐行插入会让浏览器为每一行做一次样式失效标记，一次性
// 插入同样数量的节点则只有一个插入点。收集器在插入后仍然可以继续充当该区间
// 的挂载位置，因此后续再次插入的内容仍然落在原来的位置（而不是消失）。
// A mount collector assembles a contiguous run of rendered content off-document
// and inserts it with a single DOM operation. Inserting rows one by one makes the
// browser invalidate styles per row; inserting the same nodes at once has a single
// insertion point. After the flush the collector keeps acting as the mount position
// of that run, so content inserted later still lands in place instead of vanishing.
export class MountCollector {
    flushed = false
    constructor(
        public reference: ChildNode,
        public fragment: DocumentFragment
    ) {}
}

export function createMountCollector(reference: ChildNode) {
    return new MountCollector(reference, DOCUMENT!.createDocumentFragment())
}

export function flushMountCollector(collector: MountCollector) {
    collector.reference.before(collector.fragment)
    collector.flushed = true
}

export function insertBefore(reference: ChildNode | MountCollector, node: Node) {
    if (reference instanceof MountCollector) {
        if (reference.flushed) {
            reference.reference.before(node)
        } else {
            reference.fragment.appendChild(node)
        }
        return
    }
    reference.before(node)
}

export function getSiblingAsText(node: ChildNode, distance = 1) {
    const textNode = newTextNode()
    const child = getSibling(node, distance)
    return (child.replaceWith(textNode), textNode)
}

export function getElementValue(elem: Element) {
    return any(elem)[VALUE_CACHE_KEY] ?? any(elem).value
}

export function getChild(node: Element, index = 0) {
    if ((node as any)[FRAGMENT_FLAG] & FRAG_LEADING_ANCHOR) {
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
    let content: DocumentFragment | undefined
    let singleNode: ChildNode | undefined
    return (flag = 0) => {
        if (isUndefined(content)) {
            const template = DOCUMENT!.createElement("template")
            template.innerHTML = arr ? restoreHtmlForFragment(html, arr) : html
            content = template.content
        }

        const isOrphan = flag & FRAG_ORPHAN_CONTENT
        // 孤立内容只包含一个节点时可以克隆该节点本身，省掉为每一行克隆整个
        // 文档片段再取出首个子节点带来的额外开销
        // Orphan content consists of a single node, so cloning that node directly
        // avoids cloning a whole DocumentFragment and extracting its first child
        // for every single row.
        let ret: any
        if (isOrphan && !(flag & FRAG_LEADING_ANCHOR)) {
            if (isUndefined(singleNode)) {
                singleNode = content.firstChild as ChildNode
            }
            ret = singleNode.cloneNode(true)
        } else {
            ret = content.cloneNode(true) as any
            if (flag & FRAG_LEADING_ANCHOR) {
                ret.prepend(newTextNode())
            } else if (isOrphan) {
                ret = ret.firstChild!
            }
        }
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
// 这里直接调用 DOM API：scope 属性只在挂载时设置一次且值恒为空串，通用属性
// 设置器的比较缓存对此没有意义，而绕开它可以让整个属性缓存模块在打包时被摇掉
// Apply all scope attributes from the ancestor scope chain to root elements.
// The DOM API is used directly: a scope attribute is written once at mount and its
// value is always the empty string, so the generic setter's compare cache is of no
// use here, and skipping it lets bundlers shake the whole attribute cache away.
function attachScopesToRoot(node: Element | DocumentFragment): void {
    const scopes = currentInstance?._internal.a
    if (!scopes?.length) {
        return
    }
    for (const element of isElement(node) ? [node] : arrayFrom(node.children)) {
        for (const scope of scopes) {
            element.setAttribute(scope, "")
        }
    }
}
