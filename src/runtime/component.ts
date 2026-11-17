import type {
    Destruction,
    DefaultValues,
    ComponentFunc,
    ComponentMeta,
    ComponentInstanceBase,
} from "#type-declarations/runtime";
import type {
    MountAppFunc,
    SetContextFunc,
    GetContextsFunc,
    SetContextGetterFunc,
    LifecycleHookRegister,
    GetCurrentInstanceFunc,
} from "#type-declarations/runtime-ex";
import type { AnyObject, ArbitraryFunc, GeneralFunc, Getter } from "#type-declarations/tools";

import {
    NIL,
    DEV_MODE,
    EXP_GETTER,
    AFTER_MOUNT,
    BEFORE_UPDATE,
    AFTER_UPDATE,
    BEFORE_DESTROY,
    AFTER_DESTROY,
} from "./constants";
import {
    objectKeys,
    objectCreate,
    reflectOwnKeys,
    defineProperty,
    defineProperties,
} from "../util/shared/aliases";
import {
    currentInstance,
    currentDestruction,
    setCurrentInstance,
    setCurrentDestruction,
    backToParentDestruction,
} from "./state";
import { isElement } from "../util/runtime/assert";
import { invokeRender } from "./directives/render";
import { makeExpGetter } from "../util/runtime/sundry";
import { createDestruction, destroy } from "./destroy";
import { bindHandleReceiver, shallowConstReact } from "./internal";
import { isFunction, isThenable, isString } from "../util/shared/assert";
import { markActiveEffectNoCheck, renderEffect } from "./reactivity/effect";
import { InvalidElementNode, CannotRenderComponent } from "./messages/error";
import { DST_DESTRUCTED, COMP_MOUNTED, COMP_SVG_NS } from "../util/shared/flags";
import { CreateOnDisposedComponent, LifecycleHookRegisteredAfterPhase } from "./messages/warn";
import { appendChild, getParentElement, insertBefore, newTextNode, selectElement } from "./dom";

export const onAfterMount: LifecycleHookRegister = (instance, callback) => {
    return registerLifecycleHook(instance, AFTER_MOUNT, callback, "onAfterMount");
};

export const onBeforeUpdate: LifecycleHookRegister = (instance, callback) => {
    return registerLifecycleHook(instance, BEFORE_UPDATE, callback, "onBeforeUpdate");
};

export const onAfterUpdate: LifecycleHookRegister = (instance, callback) => {
    return registerLifecycleHook(instance, AFTER_UPDATE, callback, "onAfterUpdate");
};

export const onBeforeDestroy: LifecycleHookRegister = (instance, callback) => {
    return registerLifecycleHook(instance, BEFORE_DESTROY, callback, "onBeforeDestroy");
};

export const onAfterDestroy: LifecycleHookRegister = (instance, callback) => {
    return registerLifecycleHook(instance, AFTER_DESTROY, callback, "onAfterDestroy");
};

export function getScopes(scope?: string) {
    const scopes = currentInstance?._internal.a;
    if (!(scope = scope?.slice(1))) {
        return scopes;
    }
    return scopes ? [...scopes, scope] : [scope];
}

export const mountApp: MountAppFunc = (component, target) => {
    if (isString(target)) {
        target = selectElement(target) as Element;
    }
    if (!isElement(target)) {
        InvalidElementNode('"mountApp"');
    }

    const anchor = newTextNode();
    appendChild(target, anchor);
    (component as any)(anchor);
};

export const getCurrentInstance: GetCurrentInstanceFunc = () => {
    return currentInstance as any;
};

export const getContexts: GetContextsFunc = instance => {
    return instance._internal.c! as any;
};

export const setContext: SetContextFunc = (instance, key, value) => {
    const meta = instance._internal;
    defineProperty(meta.c, key, {
        enumerable: true,
        configurable: true,
        get() {
            let val = value;
            if (val?.[EXP_GETTER]) {
                val = val.f();
            }
            markActiveEffectNoCheck();
            return val ?? meta.D?.contexts?.[key];
        },
    });
};

export const setContextGetter: SetContextGetterFunc = (instance, key, getter) => {
    (setContext as any)(instance, key, makeExpGetter(getter));
};

export function init(anchor: Node, meta: ComponentMeta) {
    const instance: ComponentInstanceBase = {
        _internal: meta,
        parent: currentInstance,
        host: getParentElement(anchor)!,
    };
    if (meta.h) {
        bindHandleReceiver(instance, meta.h);
    }
    meta.l ??= currentInstance?._internal.l ?? 0;
    meta.f = NIL;
    meta.l &= COMP_SVG_NS;
    meta.d = createDestruction(currentDestruction, instance);
    meta.c = objectCreate(currentInstance?._internal.c ?? NIL);
    return setCurrentInstance(instance);
}

export function dynamicComponent(getComponent: Getter, render: ArbitraryFunc) {
    let component: ComponentFunc | undefined;
    let destruction: Destruction | undefined;
    const componentInstance = currentInstance!;
    const parentDestruction = currentDestruction;
    renderEffect(() => {
        const currentComponent = getComponent();
        if (currentComponent === component) {
            return;
        }
        if (destruction) {
            destroy(destruction);
        }
        destruction = invokeRender(
            () => render(currentComponent),
            componentInstance,
            parentDestruction,
        );
        component = currentComponent;
    });
}

export function runHooks(instance: ComponentInstanceBase, index: number) {
    const originalInstance = currentInstance;
    const hooks = instance._internal.f?.[index];
    if (!hooks?.length) {
        return;
    }

    let firstError: unknown;
    setCurrentInstance(instance);
    try {
        for (let i = 0; i < hooks.length; i++) {
            try {
                hooks[i]();
            } catch (err) {
                firstError ??= err;
            }
        }
    } finally {
        setCurrentInstance(originalInstance);
    }
    if (firstError) {
        throw firstError;
    }
}

export function mount(anchor?: ChildNode, fragment?: Node) {
    if (anchor && fragment) {
        insertBefore(anchor, fragment);
    }

    const instance = currentInstance!;
    runHooks(instance, AFTER_MOUNT);
    backToParentDestruction();
    setCurrentInstance(instance.parent);
    instance._internal.l = (instance._internal.l ?? 0) | COMP_MOUNTED;
    return instance;
}

export function defineExports(target: any, transformed: Record<string, Getter>) {
    const descriptors: PropertyDescriptorMap = {};
    for (const key of objectKeys(transformed)) {
        descriptors[key] = {
            get: transformed[key],
            enumerable: true,
            configurable: true,
        };
    }
    return defineProperties(target, descriptors);
}

export function initProps(meta: ComponentMeta) {
    const transformed = meta.p;
    const ret: AnyObject = (meta.P = {});
    if (transformed) {
        for (const key of reflectOwnKeys(transformed)) {
            defineProperty(ret, key, {
                enumerable: true,
                get() {
                    let val = transformed[key];
                    if (isFunction(val)) {
                        val = val();
                    }
                    markActiveEffectNoCheck();
                    return val ?? meta.D?.props?.[key];
                },
            });
        }
    }
    return ret;
}

export function initRefs(meta: ComponentMeta) {
    const transformed = meta.r;
    const ret: AnyObject = (meta.R = {});
    if (transformed) {
        for (const key of reflectOwnKeys(transformed)) {
            defineProperty(ret, key, {
                enumerable: true,
                set(value) {
                    transformed[key]?.[1](value);
                },
                get() {
                    markActiveEffectNoCheck();
                    return transformed[key]?.[0]() ?? meta.D?.refs?.[key];
                },
            });
        }
    }
    return ret;
}

export function initSlots(meta: ComponentMeta) {
    const ret: AnyObject = {};
    const transformed = meta.s;
    if (transformed) {
        for (const key of reflectOwnKeys(transformed)) {
            defineProperty(ret, key, {
                enumerable: true,
                get() {
                    return !!transformed[key];
                },
            });
        }
    }
    return ret;
}

export function initContexts(meta: ComponentMeta) {
    return meta.c;
}

export function applyDefaults(defaults: DefaultValues) {
    const defaultKindMappings = [
        ["props", "P"],
        ["contexts", "c"],
        ["refs", "R", true],
    ] as const;
    const meta = currentInstance!._internal;
    for (const [kind, bound, writable] of defaultKindMappings) {
        const target = meta[bound];
        const values = defaults[kind];
        if (!values || !target) {
            continue;
        }
        if (writable) {
            defaults[kind] = shallowConstReact(values);
        }
        for (const key of reflectOwnKeys(values)) {
            if (key in target) {
                continue;
            }

            const descriptor: PropertyDescriptor = {
                enumerable: true,
                configurable: true,
                get() {
                    markActiveEffectNoCheck();
                    return defaults![kind]![key];
                },
            };
            if (writable) {
                descriptor.set = function (value) {
                    defaults![kind]![key] = value;
                };
            }
            defineProperty(target, key, descriptor);
        }
    }
    meta.D = defaults;
}

// 渲染组件：支持同步组件方法，也支持异步组件
// Render a component. Supports sync component functions as well as async components
export function renderComponent(target: any, anchor: Text, meta: ComponentMeta) {
    if (isFunction(target)) {
        target(anchor, meta);
        return;
    }
    if (!isThenable(target)) {
        CannotRenderComponent();
    }

    const parentInstance = currentInstance!;
    const parentDestruction = currentDestruction!;
    const parentInstanceDestruction = parentInstance._internal.d!;
    target.then((resolved: any) => {
        // 父组件实例已销毁
        // The parent component instance is destroyed
        if (parentInstanceDestruction.l & DST_DESTRUCTED) {
            if (DEV_MODE) {
                CreateOnDisposedComponent("component");
            }
            return;
        }

        // 当前渲染 destruction 销毁时静默跳过
        // Silently skip if the current render destruction is destroyed
        if (parentDestruction.l & DST_DESTRUCTED) {
            return;
        }

        // 动态 import 的模块：使用其 default 导出
        // Dynamic-import module: use its default export
        if (!isFunction(resolved)) {
            resolved = resolved?.default;
        }
        if (!isFunction(resolved)) {
            CannotRenderComponent();
        }
        setCurrentDestruction(parentDestruction);
        setCurrentInstance(parentInstance);
        resolved(anchor, meta);
    });
}

function registerLifecycleHook(
    instance: ComponentInstanceBase,
    index: number,
    callback: GeneralFunc,
    name: string,
) {
    const meta = instance._internal;
    // meta.l 和 meta.d.l 使用非空断言不影响运行时行为，仅用于阻止 TypeScript 报错
    // The non-null assertion of meta.l and meta.d.l does not affect runtime behavior,
    // it is only used to prevent TypeScript errors
    if (
        (index == AFTER_MOUNT && meta.l! & COMP_MOUNTED) ||
        // @ts-expect-error: undefinex will be converted to 0 implicitly
        ((index == BEFORE_DESTROY || index == AFTER_DESTROY) && meta.d?.l & DST_DESTRUCTED)
    ) {
        if (DEV_MODE) {
            LifecycleHookRegisteredAfterPhase(name);
        }
        return;
    }
    ((meta.f ??= [])[index] ??= []).push(callback);
}
