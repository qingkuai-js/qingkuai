import type { AnyObject } from "../util/types"
import type { PartialNode, QingKuaiNodeStruct } from "./types"

import { isReactive, velf } from "../util/runtime"
import { isArray, isBoolean, isEqual, isObject, strNotEqual } from "../util/shared"
import { RawValue } from "./constants"

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
    const [attrs, elem] = [qknode.attrs, qknode.n as HTMLElement]
    const isBool = isBoolean(value)
    const isClass = key === "class"
    const oldValue = attrs[key]

    // 如果value是一个响应式值，需要将其修改为其原始值，因为响应式值的每次获取
    // 都是一个新的Proxy包装值，参考：src/runtime/reactivity/value.ts
    if (isReactive(value)) {
        value = value[RawValue]
    }

    // 如果属性名为class，则需要调用transformClassName将其转换为字符串
    if (isClass) {
        value = transformClassName(value)
    }

    // 属性值与旧值相同，结束调用
    // 返回false代表此方法没有导致组件更新
    if (isEqual(oldValue, value)) {
        return false
    }

    // 1. 如果属性存在于DOM中，则修改DOM属性值，若修改后属性值无变化，表示该属性为getter
    // 2. 如果属性值是否是布尔值，则要在值为true和false时分别设置属性为空字符串和移除属性
    // 3. 判断新值与旧值的字符串表达是否相同，相同时不做处理，不同时调用setAttribute设置属性值
    if (key in elem) {
        try {
            ;(elem as any)[key] = value
        } catch (e) {
            // TODO: 警告，该DOM属性仅为getter，修改失败
            return false
        }
    } else if (isBool) {
        if (value) {
            elem.setAttribute(key, "")
        } else {
            elem.removeAttribute(key)
        }
    } else if ("" + oldValue === "" + value) {
        elem.setAttribute(key, value)
    }

    // 如果record为true（属性值是动态的）则将当前值记录在attrs中，下次调用attribute方法时
    // 当前的记录值将被用作旧值与新的属性值进行对比以判断属性值是否发生了变化
    if (record) {
        attrs[key] = value
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
