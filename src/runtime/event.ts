import type {
    EventStructure,
    SetterWithContext,
    QingKuaiNodeStruct,
    RefEventHandlerGetterGen
} from "./types"

import { attribute, selectOptions } from "./dom"
import { raw } from "./reactivity/value"
import { getValueFallback, groupCheckerGen, vewf } from "../util/runtime/sundry"
import { IS_WITH_REFERENCE_RET } from "./constants"
import { EventWrapperFlagKeys } from "../util/types"
import { isArray, isSet } from "../util/shared/assert"
import { EventListenerFlag } from "../util/shared/flag"
import { emptyArr, notEqual } from "../util/shared/sundry"

const Arrow = "Arrow"
const keyTypes = ["keydown", "keyup", "keypress"]

// 事件处理器包装器，用以支持按键标志
// Wrapper of Event Handler, to support key related flags
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
            if (!shouldInvokeHandler) {
                return
            }
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
    setter?: SetterWithContext
): EventStructure {
    const handlerGen: RefEventHandlerGetterGen = (ctx, qkNode, invokeGetter, attachUpdate) => {
        const target = qkNode.n as HTMLElement
        const targetAny = target as any
        const isSelect = target.tagName === "SELECT"
        const attrKey = attrName as keyof typeof target

        const updateAttribute = () => {
            const gotValue = raw(invokeGetter(value))
            if (isSelect) {
                return selectOptions(targetAny, gotValue)
            }

            // 引用属性为&group时setter不存在
            const checker = groupCheckerGen(gotValue)
            if (setter) {
                return attribute(qkNode, attrKey, gotValue, true)
            } else {
                return attribute(qkNode, "checked", checker(getValueFallback(qkNode)), true)
            }
        }

        // 初始化属性值并将更新属性值的方法添加到响应式值的effect中
        updateAttribute(), attachUpdate(updateAttribute)

        return () => {
            const targetValue = getValueFallback(qkNode)
            if (setter) {
                return setter(targetValue, ctx)
            }

            const gotValue = invokeGetter(value)
            const gotValueIsArray = isArray(gotValue)
            if (!isSelect) {
                if (!gotValueIsArray) {
                    gotValue.add(targetValue)
                } else if (!gotValue.includes(targetValue)) {
                    gotValue.push(targetValue)
                }
            } else {
                gotValueIsArray ? emptyArr(gotValue) : gotValue.clear()
                for (const option of (targetAny as HTMLSelectElement).selectedOptions) {
                    const optionValue = getValueFallback((option as any)._qkNode)
                    gotValueIsArray ? gotValue.push(optionValue) : gotValue.add(optionValue)
                }
            }
        }
    }

    // 标记返回值为withReference方法的返回值，在h方法中处理事件监听时，会识别
    // withReference的返回值，并调用它的返回值（即handlerGen)以设置属性的初始值，
    // 并记录更新属性的方法到依赖的响应性值的effect中
    handlerGen[IS_WITH_REFERENCE_RET] = true

    // 返回eventStructure，这里设置了compose标志，这样做是为了在输入合成过程中让setter随着
    // 输入的进行被实时调用并更新响应性值（setter是一个仅包含赋值操作的单语句函数，执行开销非常小）
    return [eventName, handlerGen, EventListenerFlag.compose]
}

function withLR(code: string): [string, string] {
    return [code + "Left", code + "Right"]
}
