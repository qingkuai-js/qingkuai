import type {
    Link,
    Effect,
    Destruction,
    EffectHandle,
    WatchCallback,
    EffectCallback,
    ComponentInstanceBase
} from "#type-declarations/runtime"
import type { ArbitraryFunc, Getter } from "#type-declarations/tools"
import type { EffectFunc, WatchFunc } from "#type-declarations/runtime-ex"

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
    EFFECT_DERIVED_READING
} from "./constants"
import {
    activeEffect,
    getIncrementEffectId,
    popRunningEffectStack,
    pushRunningEffectStack
} from "./state"
import {
    currentInstance,
    currentDestruction,
    setCurrentInstance,
    setCurrentDestruction
} from "../state"
import { NIL, NOOP, UNDEF } from "../constants"
import { DEV } from "../dev"
import { objectAssign } from "../internal"
import { getSubscription } from "./schedule"
import { any } from "../../util/shared/sundry"
import { getLastElem, swapDelete } from "../../util/shared/arrays"
import { CreateOnDisposedComponent, EffectOrWatchHasNoDependecies } from "../messages/warn"
import { isArray } from "../../util/shared/assert"

// 时序变体各自独立声明，而不是由一个工厂统一产出：只有真正被引用的 API
// （以及下方共享的构造逻辑）才会进入产物，其余会被打包器整体摇掉。
// Each timing variant is declared on its own instead of being produced by a single
// factory: only the referenced APIs (and the shared construction logic below)
// reach the bundle, the rest is tree-shaken away.
export const watch: WatchFunc = (instance, getter, callback) =>
    watchAt(TIMING_UNSET, instance, getter, callback)

export const preWatch: WatchFunc = (instance, getter, callback) =>
    watchAt(TIMING_PRE, instance, getter, callback)

export const postWatch: WatchFunc = (instance, getter, callback) =>
    watchAt(TIMING_POST, instance, getter, callback)

export const syncWatch: WatchFunc = (instance, getter, callback) =>
    watchAt(TIMING_SYNC, instance, getter, callback)

export const effect: EffectFunc = (instance, callback) =>
    reactiveEffectAt(TIMING_UNSET, instance, callback)

export const preEffect: EffectFunc = (instance, callback) =>
    reactiveEffectAt(TIMING_PRE, instance, callback)

export const postEffect: EffectFunc = (instance, callback) =>
    reactiveEffectAt(TIMING_POST, instance, callback)

export const syncEffect: EffectFunc = (instance, callback) =>
    reactiveEffectAt(TIMING_SYNC, instance, callback)

export function markActiveEffectNoCheck() {
    if (activeEffect) {
        activeEffect.l |= EFFECT_NO_CHECK
    }
}

// 渲染副作用先以"投机"方式执行一次：若它没有读取任何响应式值（例如列表行的
// 绑定只读取循环上下文），它就永远不会被响应式调度器触发，只会在上下文变化时
// 由列表重新执行。这种情况不需要副作用对象，直接把回调记录到 Destruction 上，
// 让"每个列表行零额头分配"成为常态，同时消除这些对象带来的 GC 压力。
// A render effect is first executed speculatively: if it read no reactive value
// (a list row binding that only reads the loop context, for instance) it can never
// be triggered by the reactive scheduler and is only re-run by the list when the
// context changes. Such a binding needs no effect object at all, so the callback is
// recorded on the `Destruction` instead, making "zero overhead per row" the norm
// and removing the GC pressure of those objects.
//
// 投机执行会嵌套：列表块挂载每一行时，行内的绑定会再次调用 renderEffect，所以临时
// 对象不能全局共用一个——内层调用会解绑并覆盖外层刚收集到的依赖链接，使外层（列表）
// 副作用失去依赖、不再随数据变化重新渲染。这里按嵌套深度复用一组对象，单层渲染
// （绝大多数情况）依旧零分配。
// The speculative run nests: mounting a row runs the row's bindings, which call
// `renderEffect` again. The temporary effect must therefore not be shared globally — an
// inner call would unlink and overwrite the links the outer run has just collected,
// leaving the outer (list) effect without dependencies and never re-rendering it again.
// The temporary effects are pooled by nesting depth instead; the common single-level
// case still allocates nothing.
const speculativeEffects: Effect[] = []
let speculativeDepth = 0

function getSpeculativeEffect(depth: number): Effect {
    return (speculativeEffects[depth] ??= {
        f: NOOP,
        k: [],
        x: -1,
        c: NIL,
        l: EFFECT_RENDER,
        t: TIMING_UNSET,
        d: NIL,
        i: 0
    })
}

export function renderEffect(fn: EffectCallback) {
    const destruction = currentDestruction
    if (destruction?.d) {
        if (DEV) {
            CreateOnDisposedComponent("effect")
        }
        return
    }

    const depth = speculativeDepth++
    const scratch = getSpeculativeEffect(depth)
    scratch.f = fn
    scratch.l = EFFECT_RENDER
    scratch.c = NIL
    scratch.d = destruction

    let res: any
    try {
        res = runEffectCollector(scratch)
    } finally {
        speculativeDepth = depth
    }

    // 没有依赖也没有清理函数：登记为上下文副作用即可
    // No dependencies and no cleanup function: registering it as a context effect
    // is enough.
    if (!scratch.k.length && !res) {
        if (destruction) {
            appendContextEffect(destruction, fn)
        }
        return
    }

    // 存在依赖（或清理函数）：把它变成真正的副作用，并直接沿用刚收集到的依赖链接
    // Dependencies (or a cleanup) exist: turn it into a real effect and reuse the
    // links that were collected during the speculative run.
    const effect: Effect = {
        f: fn,
        k: scratch.k,
        x: -1,
        c: res || NIL,
        l: scratch.l,
        t: TIMING_UNSET,
        d: destruction,
        i: getIncrementEffectId()
    }
    scratch.k = []
    scratch.d = NIL
    const links = effect.k
    for (let i = 0; i < links.length; i++) {
        links[i].e = effect
    }
    if (destruction) {
        attachEffectToDestruction(effect, destruction)
    }
}

export function derivedEffect(fn: ArbitraryFunc) {
    return createEffect(EFFECT_DERIVED | EFFECT_DERIVED_DIRTY, TIMING_SYNC, fn, currentDestruction)
}

export function runAndUpdateEffect(effect: Effect) {
    if (effect.l & EFFECT_DISABLED) {
        return
    }

    const res = (effect.c?.(), runEffectCollector(effect))
    effect.l &= ~EFFECT_SCHEDULING

    const isWatch = !!(effect.l & EFFECT_WATCH)

    // 对于非监视器副作用：res 就是用户自定义的清理方法
    // For non-watcher effect: `res` is the user-defined cleanup function.

    // 对于监视器副作用：res 是监视目标的最新值，回调 effect.f 的返回值才是用户自定义的清理方法
    // For watcher effect: `res` is the latest value of the watched target,
    // `effect.f` is the callback, and its return value is the user-defined cleanup function.
    effect.c = (isWatch ? effect.f(effect.v, (effect.v = res)) : res) || NIL

    checkAndDestroyInvalidEffect(effect)
}

export function appendLinksToActiveEffect(from: Effect) {
    const current = activeEffect
    if (!current || current.l & EFFECT_DISPOSED) {
        return
    }
    const isSync = any(current.t == TIMING_SYNC) // avoid a ts bug
    const fromLinks = from.k
    for (let i = 0; i < fromLinks.length; i++) {
        const link = fromLinks[i]
        const toSub = getSubscription(link.s.w, link.s.p, isSync, true)!
        if (toSub.k[toSub.a]?.e !== current) {
            const newLink: Link = {
                e: current,
                s: toSub,
                l: link.l,
                i: toSub.k.length
            }
            toSub.a = newLink.i
            toSub.k.push(newLink)
            current.k.push(newLink)
        }
    }
}

export function disposeEffect(effect: Effect, byDestruction = false) {
    if (!byDestruction) {
        detachEffectFromDestruction(effect)
    }
    effect.c?.()
    effect.c = NIL
    if (effect.k.length) {
        unlink(effect)
    }
    effect.x = -1
    effect.d = NIL
    effect.v = UNDEF
    effect.l |= EFFECT_DISABLED | EFFECT_DISPOSED
}

// 从所属 Destruction 中摘除副作用。仅有一个副作用时它被直接存放在 `d.e` 上，
// 有多个时才使用数组，因此绝大多数渲染只有零额外分配
// Detach the effect from its `Destruction`. A single effect is stored directly
// on `d.e` and only multiple effects need an array, so the common case of a
// render with one binding does not allocate at all.
function detachEffectFromDestruction(effect: Effect) {
    const destruction = effect.d
    if (!destruction) {
        return
    }
    const effects = destruction.e
    if (!effects) {
        return
    }
    if (isArray(effects)) {
        if (effect.x >= 0 && effect.x < effects.length) {
            getLastElem(effects)!.x = effect.x
            swapDelete(effects, effect.x)
        }
        if (!effects.length) {
            destruction.e = NIL
        }
    } else if (effects === effect) {
        destruction.e = NIL
    }
    effect.x = -1
}

function attachEffectToDestruction(effect: Effect, destruction: Destruction) {
    const effects = destruction.e
    if (!effects) {
        destruction.e = effect
        effect.x = 0
    } else if (isArray(effects)) {
        effect.x = effects.length
        effects.push(effect)
    } else {
        destruction.e = [effects, effect]
        effects.x = 0
        effect.x = 1
    }
}

// 上下文副作用只需要在所属渲染的上下文变化时重新执行（见 list 指令的 updateBlock）
// A context effect only has to be re-run when the context of its render changes
// (see `updateBlock` in the list directive).
export function appendContextEffect(destruction: Destruction, fn: EffectCallback) {
    const updaters = destruction.u
    if (!updaters) {
        destruction.u = fn
    } else if (isArray(updaters)) {
        updaters.push(fn)
    } else {
        destruction.u = [updaters, fn]
    }
}

export function runContextEffects(destruction: Destruction) {
    const updaters = destruction.u
    if (!updaters) {
        return
    }
    if (isArray(updaters)) {
        for (let i = 0; i < updaters.length; i++) {
            updaters[i]()
        }
    } else {
        updaters()
    }
}

function createEffect(
    flag: number,
    timing: number,
    fn: ArbitraryFunc,
    destruction: Destruction | null,
    watchCallback?: WatchCallback<any>
): Effect {
    const effect: Effect = {
        f: fn,
        k: [],
        x: -1,
        c: NIL,
        l: flag,
        t: timing,
        d: destruction,
        i: getIncrementEffectId()
    }
    if (destruction?.d) {
        if (DEV) {
            CreateOnDisposedComponent("effect")
        }
        return objectAssign<Effect, Partial<Effect>>(effect, {
            d: NIL,
            l: flag | EFFECT_DISPOSED | EFFECT_DISABLED
        })
    }

    if (watchCallback) {
        effect.g = fn
        effect.v = UNDEF
        effect.f = watchCallback
    }

    const res = runEffectCollector(effect)
    if (watchCallback) {
        effect.v = res
    } else if (res) {
        effect.c = res
    }

    // 将副作用记录到 Destruction
    // Record the effect onto `Destruction`
    if (checkAndDestroyInvalidEffect(effect) && destruction) {
        attachEffectToDestruction(effect, destruction)
    }

    return effect
}

function watchAt<T>(
    timing: number,
    instance: ComponentInstanceBase | null,
    getter: Getter<T>,
    callback: WatchCallback<T>
) {
    return makeEffectHandle(
        createEffect(EFFECT_WATCH, timing, getter, instance && instance._internal.d!, callback)
    )
}

function reactiveEffectAt(
    timing: number,
    instance: ComponentInstanceBase | null,
    callback: EffectCallback
) {
    return makeEffectHandle(createEffect(0, timing, callback, instance && instance._internal.d!))
}

function unlink(effect: Effect) {
    const links = effect.k
    for (let i = 0; i < links.length; i++) {
        const link = links[i]
        // 若 link 不处于 link.s.k 末尾，需要更新原来末尾元素的 i 属性
        // 例如：对于 [a, b, c, d]，删除 b 后变为 [a, d, c]，那么需要将 d.i 修改为 b.i
        //
        // If the `link` is not at the end of `link.s.k`, update the `i` property of the original tail element.
        // For example, given [a, b, c, d], removing `b` results in [a, d, c], so `d.i` needs to be updated to `b.i`.
        if ((swapDelete(link.s.k, link.i), link.i < link.s.k.length)) {
            link.s.k[link.i].i = link.i
        }
    }
    // Reuse the same array instance to avoid allocations and release stale link references.
    links.length = 0
}

function runEffectCollector(effect: Effect) {
    if (effect.k.length) {
        unlink(effect)
    }
    effect.l &= ~EFFECT_NO_CHECK
    pushRunningEffectStack(effect)

    const originalInstance = currentInstance
    const parentDestruction = currentDestruction
    if (setCurrentDestruction(effect.d)?.m) {
        setCurrentInstance(effect.d!.m)
    }

    const res = (effect.l & EFFECT_WATCH ? effect.g! : effect.f)()
    popRunningEffectStack()
    setCurrentInstance(originalInstance)
    setCurrentDestruction(parentDestruction)

    const collectedLinks = effect.k
    const collectedLen = collectedLinks.length
    if (collectedLen) {
        const current = activeEffect
        for (let i = 0; i < collectedLen; i++) {
            const link = collectedLinks[i]
            if (current) {
                link.s.a--
            } else {
                link.s.a = -1
            }
        }
        if (current && !(effect.l & EFFECT_RENDER)) {
            appendLinksToActiveEffect(effect)
        }
    }
    return res
}

// 检查并卸载无效的副作用：未依赖任何响应式值的副作用永远不会被再次触发
// Check and dispose invalid effects: effects that do not depend on any reactive values will never be triggered again.
function checkAndDestroyInvalidEffect(effect: Effect) {
    if (effect.l & (EFFECT_RENDER | EFFECT_NO_CHECK | EFFECT_DISABLED)) {
        return true
    }

    let isValid = effect.k.length > 0
    if (effect.l & EFFECT_DERIVED) {
        const isReading = effect.l & EFFECT_DERIVED_READING
        if (isReading) {
            effect.l &= ~EFFECT_DERIVED_READING
        }

        // 不脏的 DerivedEffect 或非读取状态时无需检查依赖项数量
        // No need to check dependency count when the DerivedEffect is not dirty or is not being read.
        isValid ||= !isReading || !(effect.l & EFFECT_DERIVED_DIRTY)
    }

    if (!isValid) {
        disposeEffect(effect)
        if (DEV) {
            const isWatch = effect.l & EFFECT_WATCH
            const isDerived = effect.l & EFFECT_DERIVED
            EffectOrWatchHasNoDependecies(
                isWatch || isDerived ? effect.g! : effect.f,
                isWatch ? "watcher" : isDerived ? "derived reactive value" : ""
            )
        }
    }
    return isValid
}

function makeEffectHandle(effect: Effect): EffectHandle {
    return {
        stop: () => {
            disposeEffect(effect)
        },
        pause: () => {
            effect.l |= EFFECT_DISABLED
        },
        resume: () => {
            if (effect.l & EFFECT_DISPOSED) {
                return
            }
            effect.l &= ~EFFECT_DISABLED
        }
    }
}
