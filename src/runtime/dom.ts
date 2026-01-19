import type { ClassAttrValue, NodeContext } from "#type-declarations/runtime"
import type { AnyObject, ArbitraryFunc, Setter } from "#type-declarations/tools"

import { currentDestruction } from "./state"
import { any, len } from "../util/shared/sundry"
import { pushDestructionCleaner } from "./destroy"
import { objectKeys } from "../util/shared/aliases"
import { DOCUMENT, NODE_CONTEXT } from "./constants"
import { reactiveNotEqual } from "../util/runtime/sundry"
import { isArray, isBoolean, isString, isUndefined } from "../util/shared/assert"

export function listen(
    elem: HTMLElement,
    type: string,
    handler: ArbitraryFunc,
    options: boolean | AddEventListenerOptions
) {
    pushDestructionCleaner(() => {
        elem.removeEventListener(type, handler, options)
    })
    elem.addEventListener(type, handler, options)
}

export function selectElement(selector: string) {
    return DOCUMENT.querySelector(selector)
}

export function replaceWithText(comment: Comment) {
    const textNode = DOCUMENT.createTextNode("")
    comment.replaceWith(textNode)
    return textNode
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

export function bindDOMReceiver(elem: any, setter: Setter) {
    pushDestructionCleaner(() => {
        setter(null)
    })
    setter(elem)
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

export function setClassName(elem: HTMLElement, value: ClassAttrValue) {
    const classList: string[] = []
    const attributes = getNodeContext(elem).a
    if (isString(value)) {
        classList.push(value)
    } else if (isArray(value)) {
        for (const item of value) {
            if (isString(item)) {
                classList.push(item)
            } else {
                classList.push(getClassNameWithObject(item))
            }
        }
    } else {
        classList.push(getClassNameWithObject(value))
    }

    const className = classList.join(" ")
    if (className != attributes.class) {
        attributes.class = elem.className = className
    }
}

export function setAttribute(elem: HTMLElement, name: string, value: any) {
    const attributes = getNodeContext(elem).a
    if (!reactiveNotEqual(attributes[name], value)) {
        return
    }
    attributes[name] = value

    if (name in elem) {
        try {
            any(elem)[name] = value
            return
        } catch {}
    }
    if (isBoolean(value)) {
        if (value) {
            value = ""
        } else {
            elem.removeAttribute(name)
            return
        }
    }
    elem.setAttribute(name, value)
}

export function setXlinkAttribute(elem: HTMLElement, name: string, value: any) {
    elem.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:" + name, value)
}

// 创建一个 HTML 片段获取器，重复获取时返回原片段的克隆副本以降低开销
// Create an HTML fragment getter that returns a cloned instance
// of the original fragment on each retrieval to minimize reuse overhead
export function createFragmentGetter(html: string, arr?: string[]) {
    let createdFragment: DocumentFragment | undefined
    const template = DOCUMENT.createElement("template")
    if (!isUndefined(arr)) {
        html = restoreHtmlForFragment(html, arr)
    }
    return () => {
        let fragment: DocumentFragment
        if (isUndefined(createdFragment)) {
            template.innerHTML = html
            fragment = createdFragment = template.content
        } else {
            fragment = createdFragment.cloneNode(true) as DocumentFragment
        }
        if (currentDestruction) {
            currentDestruction.n = [fragment.firstChild, fragment.lastChild]
        }
        return fragment
    }
}

function getClassNameWithObject(o: AnyObject) {
    const classList: string[] = []
    for (const key of objectKeys(o)) {
        if (isString(key) && o[key]) {
            classList.push(key)
        }
    }
    return classList.join(" ")
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
