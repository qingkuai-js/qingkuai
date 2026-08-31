import type {
    Destruction,
    DefaultValues,
    ComponentFunc,
    ComponentInstanceBase,
    ComponentInstanceInternal
} from "#type-declarations/runtime"
import type {
    MountAppFunc,
    SetContextFunc,
    GetContextsFunc,
    SetContextGetterFunc,
    LifecycleHookRegister,
    GetCurrentInstanceFunc
} from "#type-declarations/runtime-ex"
import type { AnyObject, ArbitraryFunc, Getter } from "#type-declarations/tools"

import {
    objectKeys,
    objectCreate,
    reflectOwnKeys,
    defineProperty,
    defineProperties
} from "../util/shared/aliases"
import {
    currentInstance,
    currentDestruction,
    setCurrentInstance,
    setCurrentDestruction,
    backToParentDestruction
} from "./state"
import { isElement } from "../util/runtime/assert"
import { invokeRender } from "./directives/render"
import { any, runAll } from "../util/shared/sundry"
import { makeExpGetter } from "../util/runtime/sundry"
import { createDestruction, destroy } from "./destroy"
import { AFTER_MOUNT, NIL, EXP_GETTER } from "./constants"
import { CreateOnDisposedComponent } from "./messages/warn"
import { bindHandleReceiver, shallowConstReact } from "./internal"
import { isFunction, isThenable, isString } from "../util/shared/assert"
import { markActiveEffectNoCheck, renderEffect } from "./reactivity/effect"
import { InvalidElementNode, CannotRenderComponent } from "./messages/error"
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
    const scopes = currentInstance?._internal.a
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

export const getCurrentInstance: GetCurrentInstanceFunc = () => {
    return currentInstance as any
}

export const getContexts: GetContextsFunc = instance => {
    return any(instance._internal.c!)
}

export const setContext: SetContextFunc = (instance, key, value) => {
    const context = instance._internal
    defineProperty(context.c, key, {
        enumerable: true,
        configurable: true,
        get() {
            let val = value
            if (val?.[EXP_GETTER]) {
                val = val.f()
            }
            markActiveEffectNoCheck()
            return val ?? context.D?.contexts?.[key]
        }
    })
}

export const setContextGetter: SetContextGetterFunc = (instance, key, getter) => {
    any(setContext)(instance, key, makeExpGetter(getter))
}

export function init(anchor: Node, context: ComponentInstanceInternal) {
    const instance: ComponentInstanceBase = {
        updating: false,
        _internal: context,
        parent: currentInstance,
        host: getParentElement(anchor)!
    }
    if (context.h) {
        bindHandleReceiver(instance, context.h)
    }
    context.f = NIL
    context.d = createDestruction(currentDestruction, instance)
    context.c = objectCreate(currentInstance?._internal.c ?? NIL)
    return setCurrentInstance(instance)
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
    const hooks = instance._internal.f?.[index]
    if (hooks?.length) {
        const originalInstance = currentInstance
        setCurrentInstance(instance)
        runAll(hooks)
        setCurrentInstance(originalInstance)
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

export function initProps(context: ComponentInstanceInternal) {
    const transformed = context.p
    const ret: AnyObject = (context.P = {})
    if (transformed) {
        for (const key of reflectOwnKeys(transformed)) {
            defineProperty(ret, key, {
                enumerable: true,
                get() {
                    let val = transformed[key]
                    if (isFunction(val)) {
                        val = val()
                    }
                    markActiveEffectNoCheck()
                    return val ?? context.D?.props?.[key]
                }
            })
        }
    }
    return ret
}

export function initRefs(context: ComponentInstanceInternal) {
    const transformed = context.r
    const ret: AnyObject = (context.R = {})
    if (transformed) {
        for (const key of reflectOwnKeys(transformed)) {
            defineProperty(ret, key, {
                enumerable: true,
                set(value) {
                    transformed[key]?.[1](value)
                },
                get() {
                    markActiveEffectNoCheck()
                    return transformed[key]?.[0]() ?? context.D?.refs?.[key]
                }
            })
        }
    }
    return ret
}

export function initSlots(context: ComponentInstanceInternal) {
    const ret: AnyObject = {}
    const transformed = context.s
    if (transformed) {
        for (const key of reflectOwnKeys(transformed)) {
            defineProperty(ret, key, {
                enumerable: true,
                get() {
                    return !!transformed[key]
                }
            })
        }
    }
    return ret
}

export function initContexts(context: ComponentInstanceInternal) {
    return context.c
}

export function applyDefaults(defaults: DefaultValues) {
    const defaultKindMappings = [
        ["props", "P"],
        ["contexts", "c"],
        ["refs", "R", true]
    ] as const
    const context = currentInstance!._internal
    for (const [kind, bound, writable] of defaultKindMappings) {
        const target = context[bound]
        const values = defaults[kind]
        if (!values || !target) {
            continue
        }
        if (writable) {
            defaults[kind] = shallowConstReact(values)
        }
        for (const key of reflectOwnKeys(values)) {
            if (key in target) {
                continue
            }

            const descriptor: PropertyDescriptor = {
                enumerable: true,
                configurable: true,
                get() {
                    markActiveEffectNoCheck()
                    return defaults![kind]![key]
                }
            }
            if (writable) {
                descriptor.set = function (value) {
                    defaults![kind]![key] = value
                }
            }
            defineProperty(target, key, descriptor)
        }
    }
    context.D = defaults
}

// 渲染组件：支持同步组件方法，也支持异步组件
// Render a component. Supports sync component functions as well as async components
export function renderComponent(target: any, anchor: Text, context: ComponentInstanceInternal) {
    if (isFunction(target)) {
        target(anchor, context)
        return
    }
    if (!isThenable(target)) {
        CannotRenderComponent()
    }

    const parentInstance = currentInstance!
    const parentDestruction = currentDestruction!
    const parentInstanceDestruction = parentInstance._internal.d!
    target.then((resolved: any) => {
        // 父组件实例已销毁
        // The parent component instance is destroyed
        if (parentInstanceDestruction.d) {
            return CreateOnDisposedComponent("component")
        }

        // 当前渲染 destruction 销毁时静默跳过
        // Silently skip if the current render destruction is destroyed
        if (parentDestruction.d) {
            return
        }

        // 动态 import 的模块：使用其 default 导出
        // Dynamic-import module: use its default export
        if (!isFunction(resolved)) {
            resolved = resolved?.default
        }
        if (!isFunction(resolved)) {
            CannotRenderComponent()
        }
        setCurrentDestruction(parentDestruction)
        setCurrentInstance(parentInstance)
        resolved(anchor, context)
    })
}

// 组件生命周期回调均为 _internal.f 数组中不同下标的元素，该方法生成用于注册
// 它们的方法；注册目标实例需显式传入，组件内经内建绑定闭包自动注入
// Component lifecycle callbacks are stored as elements at different indices
// in `_internalf; this method generates functions for registering them. The
// target instance must be passed explicitly — inside components the built-in
// binding closures inject it automatically
function hooksRegisterGen(): LifecycleHookRegister[] {
    const hookRegisters: LifecycleHookRegister[] = []
    for (let i = 1; i < 6; i++) {
        hookRegisters.push((instance, callback) => {
            ;((instance._internal.f ??= [])[i] ??= []).push(callback)
        })
    }
    return hookRegisters
}
