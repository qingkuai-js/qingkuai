import type {
    HookFunc,
    ComponentContext,
    ComponentInstance,
    QingkuaiComponent
} from "#type-declarations/runtime"
import type { AnyObject } from "#type-declarations/tools"

import { registerEvents } from "./event"
import { AFTER_MOUNT } from "./constants"
import { createDestruction } from "./destroy"
import { isElement } from "../util/runtime/assert"
import { InvalidAssignment } from "./messages/warn"
import { InvalidElementNode } from "./messages/error"
import { stripPrototype } from "../util/shared/sundry"
import { isFunction, isString } from "../util/shared/assert"
import { any, createProxy, runAll } from "../util/shared/sundry"
import { appendChild, insertBefore, newTextNode, selectElement } from "./dom"
import { backToParentDestruction, currentInstance, setCurrentInstance } from "./state"

export const [
    onBeforeMount,
    onAfterMount,
    onBeforeUpdate,
    onAfterUpdate,
    onBeforeDestroy,
    onAfterDestroy
] = hooksRegisterGen()

export function init(context: ComponentContext) {
    const instance: ComponentInstance = {
        u: false,
        h: any([]),
        p: currentInstance
    }
    setCurrentInstance(instance)
    createDestruction(instance)

    if (context.e) {
        registerEvents(context.e)
    }
    return {
        slots: initSlots(context.s),
        refs: initRefs(context.r, context.R),
        props: initProps(context.p, context.P)
    }
}

export function runHooks(instance: ComponentInstance, index: number) {
    if (instance.h[index]?.length) {
        runAll(instance.h[index]!)
    }
}

export function mount(anchor?: Element, fragment?: DocumentFragment) {
    backToParentDestruction()

    if (anchor && fragment) {
        insertBefore(anchor, fragment)
    }
    runHooks(currentInstance!, AFTER_MOUNT)
    setCurrentInstance(currentInstance!.p)
}

export function mountApp(render: QingkuaiComponent<any, any, any>, target: Element | string) {
    if (isString(target)) {
        target = selectElement(target) as Element
    }
    if (!isElement(target)) {
        InvalidElementNode('"mountApp"')
    }

    const anchor = newTextNode()
    appendChild(target, anchor)
    any(render)(anchor)
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

function initRefs(transformed: AnyObject | undefined, defaults: any) {
    if (transformed && stripPrototype(transformed)) {
        return createProxy(
            {},
            {
                get(_, property) {
                    const propValue = transformed[property]
                    if (propValue) {
                        return propValue[0]()
                    }
                    return defaults?.[property]
                },
                set(_, property, value) {
                    const propValue = transformed[property]
                    if (propValue) {
                        propValue[1](value)
                    } else if (defaults && property in defaults) {
                        defaults[property] = value
                    }
                    return true
                }
            }
        )
    }
}

function initProps(transformed: AnyObject | undefined, defaults: any) {
    if (transformed && stripPrototype(transformed)) {
        return createProxy(
            {},
            {
                get(_, property) {
                    const propValue = transformed[property]
                    if (propValue) {
                        if (!isFunction(propValue)) {
                            return propValue
                        }
                        return propValue()
                    }
                    return defaults?.[property]
                },
                set() {
                    return (InvalidAssignment("component props"), true)
                }
            }
        )
    }
}

function initSlots(transformed: AnyObject | undefined) {
    if (transformed && stripPrototype(transformed)) {
        return createProxy(
            {},
            {
                get(_, property) {
                    return !!transformed[property]
                },
                set() {
                    return true
                }
            }
        )
    }
}
