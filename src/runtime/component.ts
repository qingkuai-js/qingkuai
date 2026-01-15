import type {
    HookFunc,
    ComponentFunc,
    ComponentInstance,
    EventRegistration
} from "#type-declarations/runtime"

import { registerEvents } from "./event"
import { AFTER_MOUNT, NIL } from "./constants"
import { createDestruction } from "./destroy"
import { isString } from "../util/shared/assert"
import { isElement } from "../util/runtime/assert"
import { InvalidAssignment } from "./messages/warn"
import { InvalidElementNode } from "./messages/error"
import { stripPrototype } from "../util/runtime/sundry"
import { any, createProxy, len, runAll } from "../util/shared/sundry"
import { appendChild, createTextNode, insertBefore, selectElement } from "./dom"
import { backToParentDestruction, currentInstance, setCurrentInstance } from "./state"

export const [
    onBeforeMount,
    onAfterMount,
    onBeforeUpdate,
    onAfterUpdate,
    onBeforeDestroy,
    onAfterDestroy
] = hooksRegisterGen()

export function initSlots(transformed: any) {
    return createProxy(stripPrototype(transformed), {
        get(target, property) {
            return !!target[property]
        }
    })
}

export function initRefs(transformed: any, defaults: any) {
    return createProxy(stripPrototype(transformed), {
        get(target, property) {
            const propValue = target[property]
            if (propValue) {
                return propValue[0]()
            }
            return defaults[property]
        },
        set(target, property, value) {
            const propValue = target[property]
            if (propValue) {
                propValue[1](value)
            } else if (property in defaults) {
                defaults[property] = value
            }
            return true
        }
    })
}

export function initProps(transformed: any, defaults: any) {
    return createProxy(stripPrototype(transformed), {
        get(target, property) {
            const propValue = target[property]
            if (propValue) {
                return propValue()
            }
            return defaults[property]
        },
        set() {
            return InvalidAssignment("component props"), true
        }
    })
}

export function runHooks(instance: ComponentInstance, index: number) {
    if (len(instance.h[index])) {
        runAll(instance.h[index]!)
    }
}

export function mount(reference: ChildNode, fragment: DocumentFragment) {
    backToParentDestruction()
    insertBefore(reference, fragment)
    setCurrentInstance(currentInstance!.p)
    runHooks(currentInstance!, AFTER_MOUNT)
}

export function createApp(render: ComponentFunc, target: Element | string) {
    if (isString(target)) {
        target = selectElement(target) as Element
    }
    if (!isElement(target)) {
        InvalidElementNode("createApp")
    }

    const anchor = createTextNode()
    appendChild(target, anchor)
    render(anchor)
}

export function init(registration: EventRegistration) {
    const instance: ComponentInstance = {
        d: NIL,
        u: false,
        h: any([]),
        p: currentInstance
    }
    setCurrentInstance(instance)
    createDestruction(instance)
    registerEvents(registration)
}

// 组件生命周期回调均为 ComponentInstance.h 数组中不同下标的元素，该方法生成用于注册它们的方法
// Component lifecycle callbacks are stored as elements at different indices
// in `ComponentInstance.h`; this method generates functions for registering them
function hooksRegisterGen() {
    const hookRegisters: HookFunc[] = []
    for (let i = 0; i < 6; i++) {
        hookRegisters.push(callback => {
            ;(currentInstance!.h[i] ??= []).push(callback)
        })
    }
    return hookRegisters
}
