import type {
    Link,
    Effect,
    Destruction,
    EffectHandle,
    WatchCallback,
    EffectCallback,
    ComponentInstanceBase,
} from "#type-declarations/runtime";
import type { ArbitraryFunc, Getter } from "#type-declarations/tools";
import type { EffectFunc, WatchFunc } from "#type-declarations/runtime-ex";

import {
    TIMING_UNSET,
    TIMING_PRE,
    TIMING_POST,
    TIMING_SYNC,
    EFFECT_WATCH,
    EFFECT_RENDER,
    EFFECT_DERIVED,
    EFFECT_DISPOSED,
    EFFECT_DISABLED,
    EFFECT_NO_CHECK,
    EFFECT_SCHEDULING,
    EFFECT_DERIVED_DIRTY,
    EFFECT_DERIVED_READING,
} from "./constants";
import {
    activeEffect,
    getIncrementEffectId,
    popRunningEffectStack,
    pushRunningEffectStack,
} from "./state";
import {
    currentInstance,
    currentDestruction,
    setCurrentInstance,
    setCurrentDestruction,
} from "../state";
import { objectAssign } from "../internal";
import { getSubscription } from "./schedule";
import { isArray } from "../../util/shared/assert";
import { NIL, NOOP, UNDEF, DEV_MODE } from "../constants";
import { getLastElem, swapDelete } from "../../util/shared/arrays";
import { CreateOnDisposedComponent, EffectOrWatchHasNoDependecies } from "../messages/warn";

let speculativeDepth = 0;
const speculativeEffects: Effect[] = [];

export const watch: WatchFunc = (instance, getter, callback) => {
    return watchAt(TIMING_UNSET, instance, getter, callback);
};

export const preWatch: WatchFunc = (instance, getter, callback) => {
    return watchAt(TIMING_PRE, instance, getter, callback);
};

export const postWatch: WatchFunc = (instance, getter, callback) => {
    return watchAt(TIMING_POST, instance, getter, callback);
};

export const syncWatch: WatchFunc = (instance, getter, callback) => {
    return watchAt(TIMING_SYNC, instance, getter, callback);
};

export const effect: EffectFunc = (instance, callback) => {
    return reactiveEffectAt(TIMING_UNSET, instance, callback);
};

export const preEffect: EffectFunc = (instance, callback) => {
    return reactiveEffectAt(TIMING_PRE, instance, callback);
};

export const postEffect: EffectFunc = (instance, callback) => {
    return reactiveEffectAt(TIMING_POST, instance, callback);
};

export const syncEffect: EffectFunc = (instance, callback) => {
    return reactiveEffectAt(TIMING_SYNC, instance, callback);
};

export function markActiveEffectNoCheck() {
    if (activeEffect) {
        activeEffect.l |= EFFECT_NO_CHECK;
    }
}

export function renderEffect(fn: EffectCallback) {
    const destruction = currentDestruction;
    if (destruction?.d) {
        if (DEV_MODE) {
            CreateOnDisposedComponent("effect");
        }
        return;
    }

    let res: any;
    const depth = speculativeDepth++;
    const scratch = getSpeculativeEffect(depth);
    scratch.f = fn;
    scratch.c = NIL;
    scratch.d = destruction;
    scratch.l = EFFECT_RENDER;

    try {
        res = runEffectCollector(scratch);
    } catch (err) {
        if (scratch.k.length) {
            unlink(scratch);
        }
        scratch.d = scratch.c = NIL;
        throw err;
    } finally {
        speculativeDepth = depth;
    }

    // 没有依赖也没有清理函数，直接退出
    // No dependencies and no cleanup function, exit directly.
    if (!scratch.k.length && !res) {
        return;
    }

    const effect: Effect = {
        f: fn,
        x: -1,
        k: scratch.k,
        c: res || NIL,
        l: scratch.l,
        t: TIMING_UNSET,
        d: destruction,
        i: getIncrementEffectId(),
    };
    scratch.k = [];
    scratch.d = NIL;

    const links = effect.k;
    for (let i = 0; i < links.length; i++) {
        links[i].e = effect;
    }
    if (destruction) {
        attachEffectToDestruction(effect, destruction);
    }
}

export function derivedEffect(fn: ArbitraryFunc) {
    return createEffect(EFFECT_DERIVED | EFFECT_DERIVED_DIRTY, TIMING_SYNC, fn, currentDestruction);
}

export function runAndUpdateEffect(effect: Effect) {
    if (effect.l & EFFECT_DISABLED) {
        return;
    }

    let res: any;
    try {
        const cleanup = effect.c;
        effect.c = NIL;
        cleanup?.();
        res = runEffectCollector(effect);
    } finally {
        effect.l &= ~EFFECT_SCHEDULING;
    }

    const isWatch = !!(effect.l & EFFECT_WATCH);

    // 对于非监视器副作用：res 就是用户自定义的清理方法
    // For non-watcher effect: `res` is the user-defined cleanup function.
    //
    // 对于监视器副作用：res 是监视目标的最新值，回调 effect.f 的返回值才是用户自定义的清理方法
    // For watcher effect: `res` is the latest value of the watched target,
    // `effect.f` is the callback, and its return value is the user-defined cleanup function.
    effect.c = (isWatch ? effect.f(effect.v, (effect.v = res)) : res) || NIL;

    checkAndDestroyInvalidEffect(effect);
}

export function appendLinksToActiveEffect(from: Effect) {
    const current = activeEffect;
    if (!current || current.l & EFFECT_DISPOSED) {
        return;
    }

    const isSync = current.t == (TIMING_SYNC as any); // avoid a ts bug
    const fromLinks = from.k;
    for (let i = 0; i < fromLinks.length; i++) {
        const link = fromLinks[i];
        const toSub = getSubscription(link.s.w, link.s.p, isSync, true)!;
        if (toSub.k[toSub.a]?.e !== current) {
            const newLink: Link = {
                e: current,
                s: toSub,
                l: link.l,
                i: toSub.k.length,
            };
            toSub.a = newLink.i;
            toSub.k.push(newLink);
            current.k.push(newLink);
        }
    }
}

export function disposeEffect(effect: Effect, byDestruction = false) {
    if (!byDestruction) {
        detachEffectFromDestruction(effect);
    }
    if (effect.k.length) {
        unlink(effect);
    }

    const cleanup = effect.c;
    effect.x = -1;
    effect.v = UNDEF;
    effect.c = effect.d = NIL;
    effect.l |= EFFECT_DISABLED | EFFECT_DISPOSED;
    cleanup?.();
}

// 从所属 Destruction 中摘除副作用。仅有一个副作用时它被直接存放在 `d.e` 上，
// 有多个时才使用数组，因此绝大多数渲染只有零额外分配
//
// Detach the effect from its `Destruction`. A single effect is stored directly
// on `d.e` and only multiple effects need an array, so the common case of a
// render with one binding does not allocate at all.
function detachEffectFromDestruction(effect: Effect) {
    const destruction = effect.d;
    if (!destruction) {
        return;
    }
    const effects = destruction.e;
    if (!effects) {
        return;
    }
    if (isArray(effects)) {
        if (effect.x >= 0 && effect.x < effects.length) {
            getLastElem(effects)!.x = effect.x;
            swapDelete(effects, effect.x);
        }
        if (!effects.length) {
            destruction.e = NIL;
        }
    } else if (effects === effect) {
        destruction.e = NIL;
    }
    effect.x = -1;
}

function attachEffectToDestruction(effect: Effect, destruction: Destruction) {
    const effects = destruction.e;
    if (!effects) {
        destruction.e = effect;
        effect.x = 0;
    } else if (isArray(effects)) {
        effect.x = effects.length;
        effects.push(effect);
    } else {
        destruction.e = [effects, effect];
        effects.x = 0;
        effect.x = 1;
    }
}

function createEffect(
    flag: number,
    timing: number,
    fn: ArbitraryFunc,
    destruction: Destruction | null,
    watchCallback?: WatchCallback<any>,
): Effect {
    const effect: Effect = {
        f: fn,
        k: [],
        x: -1,
        c: NIL,
        l: flag,
        t: timing,
        d: destruction,
        i: getIncrementEffectId(),
    };
    if (destruction?.d) {
        if (DEV_MODE) {
            CreateOnDisposedComponent("effect");
        }
        return objectAssign<Effect, Partial<Effect>>(effect, {
            d: NIL,
            l: flag | EFFECT_DISPOSED | EFFECT_DISABLED,
        });
    }

    if (watchCallback) {
        effect.g = fn;
        effect.v = UNDEF;
        effect.f = watchCallback;
    }

    const res = runEffectCollector(effect);
    if (watchCallback) {
        effect.v = res;
    } else if (res) {
        effect.c = res;
    }

    // 将副作用记录到 Destruction
    // Record the effect onto `Destruction`
    if (checkAndDestroyInvalidEffect(effect) && destruction) {
        attachEffectToDestruction(effect, destruction);
    }

    return effect;
}

function watchAt<T>(
    timing: number,
    instance: ComponentInstanceBase | null,
    getter: Getter<T>,
    callback: WatchCallback<T>,
) {
    return makeEffectHandle(
        createEffect(EFFECT_WATCH, timing, getter, instance && instance._internal.d!, callback),
    );
}

function reactiveEffectAt(
    timing: number,
    instance: ComponentInstanceBase | null,
    callback: EffectCallback,
) {
    return makeEffectHandle(createEffect(0, timing, callback, instance && instance._internal.d!));
}

function unlink(effect: Effect) {
    const links = effect.k;
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        // 若 link 不处于 link.s.k 末尾，需要更新原来末尾元素的 i 属性
        // 例如：对于 [a, b, c, d]，删除 b 后变为 [a, d, c]，那么需要将 d.i 修改为 b.i
        //
        // If the `link` is not at the end of `link.s.k`, update the `i` property of the original tail element.
        // For example, given [a, b, c, d], removing `b` results in [a, d, c], so `d.i` needs to be updated to `b.i`.
        if ((swapDelete(link.s.k, link.i), link.i < link.s.k.length)) {
            link.s.k[link.i].i = link.i;
        }
    }
    // Reuse the same array instance to avoid allocations and release stale link references.
    links.length = 0;
}

function runEffectCollector(effect: Effect) {
    if (effect.k.length) {
        unlink(effect);
    }
    effect.l &= ~EFFECT_NO_CHECK;
    pushRunningEffectStack(effect);

    const originalInstance = currentInstance;
    const parentDestruction = currentDestruction;
    if (setCurrentDestruction(effect.d)?.m) {
        setCurrentInstance(effect.d!.m);
    }

    let res: any;
    let succeeded = false;
    try {
        res = (effect.l & EFFECT_WATCH ? effect.g! : effect.f)();
        succeeded = true;
    } finally {
        popRunningEffectStack();
        setCurrentInstance(originalInstance);
        setCurrentDestruction(parentDestruction);

        const current = activeEffect;
        const collectedLinks = effect.k;
        const collectedLen = collectedLinks.length;
        for (let i = 0; i < collectedLen; i++) {
            const link = collectedLinks[i];
            if (current) {
                link.s.a--;
            } else {
                link.s.a = -1;
            }
        }
        if (succeeded && current && !(effect.l & EFFECT_RENDER)) {
            appendLinksToActiveEffect(effect);
        }
    }
    return res;
}

// 检查并卸载无效的副作用：未依赖任何响应式值的副作用永远不会被再次触发
// Check and dispose invalid effects: effects that do not depend on any reactive values will never be triggered again.
function checkAndDestroyInvalidEffect(effect: Effect) {
    if (effect.l & (EFFECT_RENDER | EFFECT_NO_CHECK | EFFECT_DISABLED)) {
        return true;
    }

    let isValid = effect.k.length > 0;
    if (effect.l & EFFECT_DERIVED) {
        const isReading = effect.l & EFFECT_DERIVED_READING;
        if (isReading) {
            effect.l &= ~EFFECT_DERIVED_READING;
        }

        // 不脏的 DerivedEffect 或非读取状态时无需检查依赖项数量
        // No need to check dependency count when the DerivedEffect is not dirty or is not being read.
        isValid ||= !isReading || !(effect.l & EFFECT_DERIVED_DIRTY);
    }

    if (!isValid) {
        disposeEffect(effect);
        if (DEV_MODE) {
            const isWatch = effect.l & EFFECT_WATCH;
            const isDerived = effect.l & EFFECT_DERIVED;
            EffectOrWatchHasNoDependecies(
                isWatch || isDerived ? effect.g! : effect.f,
                isWatch ? "watcher" : isDerived ? "derived reactive value" : "",
            );
        }
    }
    return isValid;
}

function getSpeculativeEffect(depth: number): Effect {
    return (speculativeEffects[depth] ??= {
        k: [],
        i: 0,
        x: -1,
        d: NIL,
        c: NIL,
        f: NOOP,
        t: TIMING_UNSET,
        l: EFFECT_RENDER,
    });
}

function makeEffectHandle(effect: Effect): EffectHandle {
    return {
        stop: () => {
            disposeEffect(effect);
        },
        pause: () => {
            effect.l |= EFFECT_DISABLED;
        },
        resume: () => {
            if (effect.l & EFFECT_DISPOSED) {
                return;
            }
            effect.l &= ~EFFECT_DISABLED;
        },
    };
}
