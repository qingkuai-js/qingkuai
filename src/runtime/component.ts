import type { AnyObject, Getter } from "#type-declarations/tools"
import type { LifecycleHookRegister, MountAppFunc } from "#type-declarations/runtime-ex"
import type { ComponentContext, ComponentInstanceBase } from "#type-declarations/runtime"

import { registerEvents } from "./event"
import { AFTER_MOUNT } from "./constants"
import { createDestruction } from "./destroy"
import { constReact } from "./reactivity/value"
import { isElement } from "../util/runtime/assert"
import { InvalidAssignment } from "./messages/warn"
import { InvalidElementNode } from "./messages/error"
import { isFunction, isString } from "../util/shared/assert"
import { any, createProxy, runAll } from "../util/shared/sundry"
import { defineProperties, objectKeys } from "../util/shared/aliases"
import { appendChild, insertBefore, newTextNode, selectElement } from "./dom"
import { backToParentDestruction, currentInstance, setCurrentInstance } from "./state"

// prettier-ignore
export const [
    onAfterMount,
    onBeforeUpdate,
    onAfterUpdate,
    onBeforeDestroy,
    onAfterDestroy
] = hooksRegisterGen()

export const mountApp: MountAppFunc = (component, target) => {
    if (isString(target)) {
        target = selectElement(target) as Element
    }
    if (!isElement(target)) {
        InvalidElementNode('"mountApp"')
    }

    const anchor = newTextNode()
    appendChild(target, anchor)
    any(component)(anchor)
}

export function init(context: ComponentContext) {
    const instance: ComponentInstanceBase = {
        updating: false,
        hooks: any([]),
        parent: currentInstance
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

export function runHooks(instance: ComponentInstanceBase, index: number) {
    if (instance.hooks[index]?.length) {
        runAll(instance.hooks[index]!)
    }
}

export function mount(anchor?: Element, fragment?: DocumentFragment) {
    const instance = currentInstance!
    backToParentDestruction()

    if (anchor && fragment) {
        insertBefore(anchor, fragment)
    }
    runHooks(instance, AFTER_MOUNT)
    setCurrentInstance(instance.parent)
    return instance
}

export function defineExports(target: any, transformed: Record<string, Getter>) {
    const descriptors: PropertyDescriptorMap = {}
    for (const key of objectKeys(transformed)) {
        descriptors[key] = {
            get: transformed[key],
            enumerable: true,
            configurable: true
        }
    }
    return defineProperties(target, descriptors)
}

// 组件生命周期回调均为 ComponentInstance.h 数组中不同下标的元素，该方法生成用于注册它们的方法
// Component lifecycle callbacks are stored as elements at different indices
// in `ComponentInstance.h`; this method generates functions for registering them
function hooksRegisterGen(): LifecycleHookRegister[] {
    const hookRegisters: LifecycleHookRegister[] = []
    for (let i = 1; i < 6; i++) {
        hookRegisters.push(callback => {
            ;(currentInstance!.hooks[i] ??= []).push(callback)
        })
    }
    return hookRegisters
}

function initSlots(transformed?: AnyObject) {
    return createProxy(
        {},
        {
            get(_, property: string) {
                return !!transformed?.[property]
            },
            set() {
                return true
            }
        }
    )
}

function initRefs(transformed?: AnyObject, defaults?: AnyObject) {
    if (defaults) {
        defaults = constReact(defaults)
    }
    return createProxy(
        {},
        {
            get(_, property: string) {
                let ret = transformed?.[property]
                if (ret) {
                    ret = ret[0]()
                }
                return ret ?? defaults?.[property]
            },
            set(_, property: string, value) {
                let ret = transformed?.[property]
                if (ret) {
                    ret = ret[1](value)
                } else if (defaults && property in defaults) {
                    defaults[property] = value
                }
                return true
            }
        }
    )
}

function initProps(transformed?: AnyObject, defaults?: AnyObject) {
    return createProxy(
        {},
        {
            get(_, property: string) {
                let ret = transformed?.[property]
                if (ret) {
                    if (isFunction(ret)) {
                        ret = ret()
                    }
                }
                return ret ?? defaults?.[property]
            },
            set() {
                return (InvalidAssignment("component props"), true)
            }
        }
    )
}
