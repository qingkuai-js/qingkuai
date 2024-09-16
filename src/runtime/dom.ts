import type { AnyObject } from "../util/types"
import type { PartialNode, QingKuaiNodeStruct } from "./types"

import { nextTick } from "./schedule"
import { velf } from "../util/runtime"
import { isArray, isBoolean, isObject } from "../util/shared"

export function destroy(node: Node) {
    node.parentNode!.removeChild(node)
}

export function textNode(content: string) {
    return document.createTextNode(content)
}

export function comment(qknode: QingKuaiNodeStruct, content: string) {
    qknode.n = document.createComment(content)
}

export function element(qknode: QingKuaiNodeStruct, tag: string) {
    qknode.n = document.createElement(tag)
}

export function insert(target: Node, node: Node, reference: PartialNode) {
    target.insertBefore(node, reference)
}

export function text(qknode: QingKuaiNodeStruct, content: any, record: boolean) {
    content = "" + content
    if (record) {
        qknode.text = content
    }
    qknode.n = textNode("" + content)
}

export function setText(qknode: QingKuaiNodeStruct, content: any, record: boolean) {
    content = "" + content
    if (qknode.text === content) {
        return false
    }
    if (record) {
        qknode.text = content
    }
    return (qknode.n!.textContent = "" + content), true
}

export function attribute(qknode: QingKuaiNodeStruct, key: string, value: any, record: boolean) {
    const { attrs } = qknode
    const isBool = isBoolean(value)
    const elem = qknode.n as HTMLElement
    const isClass = key === "class"
    const toStr = !isBool && !isClass
    if (toStr) {
        value = "" + value
    } else if (isClass) {
        value = transformClassName(value)
    }

    if (attrs![key] === value) {
        return false
    }
    if (record) {
        attrs![key] = value
    }

    if (key === "style") {
        elem.style.cssText = value
    } else if (isBool && !value) {
        elem.removeAttribute(key)
    } else if (key in elem) {
        nextTick(() => ((elem as any)[key] = value))
    } else {
        elem.setAttribute(key, isBool ? "" : value)
    }
    return true
}

export function listen(node: Node, key: string, handler: EventListener, flag: number) {
    const useStop = velf(flag, "stop")
    const useSelf = velf(flag, "self")
    const usePrevent = velf(flag, "prevent")
    const useWrapper = useStop || usePrevent || useSelf
    const wrapper: EventListener = function (this: any, evt) {
        if (!useSelf || evt.target === this) {
            handler.call(this, evt)
            useStop && evt.stopPropagation()
            usePrevent && evt.preventDefault()
        }
    }
    node.addEventListener(key, useWrapper ? wrapper : handler, {
        once: velf(flag, "once"),
        capture: velf(flag, "capture"),
        passive: velf(flag, "passive")
    })
    return () => node.removeEventListener(key, handler)
}

// process class value of array and object format
export function transformClassName(value: any) {
    const valueArr: any[] = []
    const valueIsArray = isArray(value)
    const transformObject = (obj: AnyObject) => {
        Object.keys(obj).forEach(key => {
            if (obj[key]) {
                valueArr.push(key)
            }
        })
    }
    const transformArray = (arr: any[]) => {
        for (const item of arr) {
            if (isArray(item)) {
                transformArray(item)
            } else if (isObject(item)) {
                transformObject(item)
            } else {
                valueArr.push("" + item)
            }
        }
    }
    if (!valueIsArray && !isObject(value)) {
        return value
    }
    if (valueIsArray) {
        transformArray(value)
    } else {
        transformObject(value)
    }
    return valueArr.join(" ").replace(/\s+/g, " ")
}
