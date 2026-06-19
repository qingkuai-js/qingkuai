import type {
    Destruction,
    ComponentContext,
    ComponentInstanceBase,
    ComponentFunc
} from "#type-declarations/runtime"
import type { AnyObject, ArbitraryFunc, Getter } from "#type-declarations/tools"
import type { LifecycleHookRegister, MountAppFunc } from "#type-declarations/runtime-ex"

import {
    objectKeys,
    reflectOwnKeys,
    defineProperty,
    defineProperties
} from "../util/shared/aliases"
import {
    currentInstance,
    currentDestruction,
    setCurrentInstance,
    backToParentDestruction
} from "./state"
import { constReact } from "./internal"
import { registerEvents } from "./event"
import { AFTER_MOUNT } from "./constants"
import { isElement } from "../util/runtime/assert"
import { invokeRender } from "./directives/render"
import { any, runAll } from "../util/shared/sundry"
import { InvalidElementNode } from "./messages/error"
import { createDestruction, destroy } from "./destroy"
import { isFunction, isString } from "../util/shared/assert"
import { markActiveEffectNoCheck, renderEffect } from "./reactivity/effect"
import { appendChild, getParentElement, insertBefore, newTextNode, selectElement } from "./dom"

// prettier-ignore
export const [
    onAfterMount,
    onBeforeUpdate,
    onAfterUpdate,
    onBeforeDestroy,
    onAfterDestroy
] = hooksRegisterGen()

export function getScopes(scope?: string) {
    const scopes = currentInstance?.context.a
    if (!(scope = scope?.slice(1))) {
        return scopes
    }
    return scopes ? [...scopes, scope] : [scope]
}

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

export function init(anchor: Node, context: ComponentContext) {
    const instance: ComponentInstanceBase = {
        context,
        hooks: any([]),
        updating: false,
        parent: currentInstance,
        host: getParentElement(anchor)!
    }
    setCurrentInstance(instance)
    createDestruction(currentDestruction, instance)

    if (context.e) {
        registerEvents(context.e)
    }
    return {
        slots: initSlots(context.s),
        refs: initRefs(context.r, context.R),
        props: initProps(context.p, context.P)
    }
}

export function dynamicComponent(getComponent: Getter, render: ArbitraryFunc) {
    let component: ComponentFunc | undefined
    let destruction: Destruction | undefined
    const componentInstance = currentInstance!
    const parentDestruction = currentDestruction
    renderEffect(() => {
        const currentComponent = getComponent()
        if (currentComponent === component) {
            return
        }
        if (destruction) {
            destroy(destruction)
        }
        destruction = invokeRender(
            () => render(currentComponent),
            componentInstance,
            parentDestruction
        )
        component = currentComponent
    })
}

export function runHooks(instance: ComponentInstanceBase, index: number) {
    if (instance.hooks[index]?.length) {
        runAll(instance.hooks[index]!)
    }
}

export function mount(anchor?: ChildNode, fragment?: Node) {
    if (anchor && fragment) {
        insertBefore(anchor, fragment)
    }

    const instance = currentInstance!
    runHooks(instance, AFTER_MOUNT)
    backToParentDestruction()
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

// 组件生命周期回调均为 ComponentInstance.hooks 数组中不同下标的元素，该方法生成用于注册它们的方法
// Component lifecycle callbacks are stored as elements at different indices
// in `ComponentInstance.hooks`; this method generates functions for registering them
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
    const ret: AnyObject = {}
    if (transformed) {
        for (const key of reflectOwnKeys(transformed)) {
            defineProperty(ret, key, {
                get() {
                    return !!transformed[key]
                },
                enumerable: true
            })
        }
    }
    return ret
}

function initRefs(transformed?: AnyObject, ret: AnyObject = {}) {
    if (((ret = constReact(ret)), transformed)) {
        for (const key of reflectOwnKeys(transformed)) {
            defineProperty(ret, key, {
                get() {
                    markActiveEffectNoCheck()
                    return transformed[key]?.[0]() ?? ret[key]
                },
                set(value) {
                    transformed[key]?.[1](value)
                },
                enumerable: true
            })
        }
    }
    return ret
}

function initProps(transformed?: AnyObject, defaults?: AnyObject) {
    const ret: AnyObject = {}
    if (defaults) {
        for (const key of reflectOwnKeys(defaults)) {
            defineProperty(ret, key, {
                get() {
                    return defaults[key]
                },
                enumerable: true,
                configurable: true
            })
        }
    }
    if (transformed) {
        for (const key of reflectOwnKeys(transformed)) {
            defineProperty(ret, key, {
                get() {
                    let val = transformed[key]
                    if (isFunction(val)) {
                        val = val()
                    }
                    markActiveEffectNoCheck()
                    return val ?? defaults?.[key]
                },
                enumerable: true
            })
        }
    }
    return ret
}
