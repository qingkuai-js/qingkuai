import type { Setter, EventStructure, RefEventHandlerGetterGen, QingKuaiNodeStruct } from "./types"

import { attribute } from "./dom"
import { raw } from "./reactivity/value"
import { spliceByElem, vewf } from "../util/runtime"
import { EventWrapperFlagKeys } from "../util/types"
import { IsWithReferenceRet, noop } from "./constants"
import { EventListenerFlag, isArray, optc } from "../util/shared"
import { ContainerTypeIsBad } from "./message/error"

const Arrow = "Arrow"
const keyTypes = ["keydown", "keyup", "keypress"]

// 事件处理器包装器，用以支持按键修饰符与按键别名
// Wrapper of Event Handler, to support key modifiers and key aliases.
export function eventWrapper(
    fn: EventListener,
    flag: number = 0,
    other: string = ""
): EventListener {
    return function (this: any, event) {
        let code = ""
        let shouldInvokeHandler = true
        const keyRelated = keyTypes.includes(event.type)

        const verify = (fk: EventWrapperFlagKeys, ...pks: string[]) => {
            if (!shouldInvokeHandler) return
            if (vewf(flag, fk)) {
                // @ts-ignore
                shouldInvokeHandler = pks.includes(code) || event[fk + "Key"]
            }
        }

        if (keyRelated) {
            code = (event as KeyboardEvent).code
            verify("tab", "Tab")
            verify("esc", "Escape")
            verify("space", "Space")
            verify("up", Arrow + "Up")
            verify("down", Arrow + "Down")
            verify("left", Arrow + "Left")
            verify("right", Arrow + "Right")
            verify("del", "Delete", "Backspace")
            verify("enter", "Enter", "NumpadEnter")
            if (shouldInvokeHandler && other) {
                shouldInvokeHandler = code === other
            }
        }

        verify("alt", ...withLR("Alt"))
        verify("meta", ...withLR("Meta"))
        verify("shift", ...withLR("Shift"))
        verify("ctrl", ...withLR("Control"))

        shouldInvokeHandler && fn.call(this, event)
    }
}

// 生成原生标签引用属性使用的事件结构
export function withReference(
    eventName: string,
    attrName: string,
    value: any,
    setter: Setter
): EventStructure {
    const handlerGen: RefEventHandlerGetterGen = (qkNode, invokeGetter, attachUpdate) => {
        const target = qkNode.n as HTMLElement
        const attrKey = attrName as keyof typeof target

        // 初始化属性值，并将修改属性值的方法添加到所依赖的响应性值的effect中
        const setAttribute = () => {
            const gotValue = raw(invokeGetter(value))

            // 查看选项值是否已经被包含，这里针对容器为数组或集合的不同情况声明了
            // 不同的判断方法，避免在检查多个option元素时的重复类型判断
            const isValueIncluded: (rv: any) => void = isArray(gotValue)
                ? rv => gotValue.includes(rv)
                : optc(gotValue) === "Set"
                ? rv => gotValue.has(rv)
                : noop

            if (target.tagName === "INPUT" && attrName === "group") {
                if (isValueIncluded === noop) {
                    ContainerTypeIsBad("input", "group")
                }

                // gotValue中是否含有qkNode的value属性值即表示当前input元素是否被选中
                const checked = isValueIncluded(qkNode.attrs.value)
                return attribute(qkNode, "checked", checked, true)
            } else if (target.tagName === "SELECT") {
                if (isValueIncluded === noop) {
                    ContainerTypeIsBad("select", "value")
                }

                // gotValue中是否含有oqn的value属性值即表示option元素是否被选中
                // 如果设置某个option元素的属性值（attribute调用）时返回true，则表示组件有更新
                let hasUpdated = false
                for (const option of (target as any).options) {
                    const oqn = option["_qkNode"] as QingKuaiNodeStruct
                    const selected = isValueIncluded(oqn.attrs.value)
                    hasUpdated ||= attribute(oqn, "selected", selected, true)
                }
                return hasUpdated
            } else {
                // 非radio/checkbox控件的group属性或select元素的value属性，正常处理，
                // 可能的情况：radio/checkbox控件的checked属性，option的selected属性
                // 若后续版本为其他普通标签添加了可接受的引用属性，请更新《可能情况》以使逻辑清晰
                return attribute(qkNode, attrKey, gotValue, true)
            }
        }
        setAttribute() && attachUpdate(setAttribute)

        return () => event => {
            if (setter) {
                setter(target[attrKey])
            } else {
                const valueRaw = qkNode.attrs.value
                const gotValue = invokeGetter(value)
                const inputTarget = target as HTMLInputElement
                const containerMethods: {
                    add: (rv: any) => void
                    delete: (rv: any) => void
                } = isArray(gotValue)
                    ? {
                          add: rv => gotValue.push(rv),
                          delete: rv => spliceByElem(gotValue, rv)
                      }
                    : optc(gotValue) === "Set"
                    ? gotValue
                    : {}

                if (inputTarget.checked) {
                    gotValue.add(valueRaw)
                } else {
                    gotValue.delete(gotValue, valueRaw)
                }
            }
        }
    }

    // 标记返回值为withReference方法的返回值，在h方法中处理事件监听时，会识别
    // withReference的返回值，并调用它的返回值（即handlerGen)以设置属性的初始值，
    // 并记录更新属性的方法到依赖的响应性值的effect中
    handlerGen[IsWithReferenceRet] = true

    // 返回eventStructure，这里设置了compose标志，这样做是为了在输入合成过程中让setter随着
    // 输入的进行被实时调用并更新响应性值（setter是一个仅包含赋值操作的单语句函数，执行开销非常小）
    return [eventName, handlerGen, EventListenerFlag.compose]
}

function withLR(code: string): [string, string] {
    return [code + "Left", code + "Right"]
}
