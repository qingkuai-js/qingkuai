import type { EventStructure, WithBindNativeTarget } from "./types"

import { isArray } from "../util/shared"
import { EventWrapperFlagKeys } from "../util/types"
import { spliceByElem, vewf } from "../util/runtime"

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

// 生成为bind指令创建的事件结构
export function withReference(eventName: string, v: any, setter: (v: any) => void): EventStructure {
    const bindHandler: () => EventListener = () => event => {
        let prop: keyof WithBindNativeTarget = "value"

        const target = event.target as WithBindNativeTarget
        const isInput = target.tagName === "INPUT"
        const isSelect = target.tagName === "SELECT"
        const type = target.type

        if (isSelect || (isInput && (type === "radio" || type === "checkbox"))) {
            prop = "checked" as any
        }
        if (isInput && isArray(v) && target.type === "checkbox") {
            if (target[prop]) {
                v.push(target.value)
            } else {
                spliceByElem(v, target.value)
            }
        } else {
            setter(target[prop])
        }
    }

    return [eventName, bindHandler, 0]
}

function withLR(code: string): [string, string] {
    return [code + "Left", code + "Right"]
}
