import type { AnyObject } from "../util/types"
import type { PartialNode, QingKuaiNodeStruct } from "./types"

import { RawValue } from "./constants"
import { velf } from "../util/runtime/sundry"
import { isReactive } from "../util/runtime/assert"
import { AssignmentToDOMGetterProp } from "./message/warn"
import { isArray, isBoolean, isObject } from "../util/shared/assert"

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
    if (tag === "!") {
        qknode.n = document.createComment(tag)
    } else {
        qknode.n = document.createElement(tag)
    }
}

export function insert(target: Node, node: Node, reference: PartialNode) {
    target.insertBefore(node, reference)
}

export function text(qknode: QingKuaiNodeStruct, content: any, record: boolean) {
    content = textContenValuet2Str(content)
    if (record) {
        qknode.text = content
    }
    qknode.n = textNode("" + content)
}

export function setText(qknode: QingKuaiNodeStruct, content: any, record: boolean) {
    content = textContenValuet2Str(content)
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

    // 如果value是一个响应式值，需要通过RawValue访问并使用其原始值
    // 每次访问响应式值都会得到一个新的Proxy包装值，参考：file://./reactivity/value.ts
    if (isReactive(value)) {
        value = value[RawValue]
    }

    // 如果属性名为class，则需要调用transformClassName将其转换为字符串
    if (key === "class") {
        value = transformClassName(value)
    }

    // 1. 如果属性存在于DOM中，则修改DOM属性值，若修改后属性值无变化，表示该属性为getter
    // 2. 如果属性值是否是布尔值，则要在值为true和false时分别设置属性为空字符串和移除属性
    // 3. 判断新值与旧值的字符串表达是否相同，相同时不做处理，不同时调用setAttribute设置属性值
    if (key in elem) {
        try {
            const elemAny = elem as any
            const isBool = isBoolean(elemAny[key])
            if (isBool && value === "") {
                elemAny[key] = true
            } else {
                elemAny[key] = value
            }
        } catch (e) {
            return AssignmentToDOMGetterProp(e), false
        }
    } else {
        // 新值与旧值字符串表达相同，结束调用，返回fasle表示此方法未导致组件更新
        if ("" + attrs[key] === "" + value) {
            return false
        }
        if (isBoolean(value)) {
            if (value) {
                elem.setAttribute(key, "")
            } else {
                elem.removeAttribute(key)
            }
        } else {
            elem.setAttribute(key, value)
        }
    }

    // 根据record判断是否需要记录属性值，一般情况下当属性值依赖了响应式值时record为true，
    // 此时需要将当前属性值记录在attrs中，这个记录的作用有两个：
    // 1. radio/checkbox控件的group或select元素的value引用属性事件中获取选项的原始值
    // 2. 在调用setAttribute方法之前与旧值的字符串表达做对比，去除无意义DOM操作的开销
    record && (attrs[key] = value)

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

function textContenValuet2Str(content: string | any[]) {
    return isArray(content) ? content.join("") : content
}
