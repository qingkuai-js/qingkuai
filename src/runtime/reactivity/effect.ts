import type {
    Link,
    Effect,
    EffectHandle,
    GeneralEffectFunc,
    WatchEffectCallback
} from "#type-declarations/runtime"
import type { ArbitraryFunc, Getter } from "#type-declarations/tools"
import type { CreateEffect, CreateWatcher } from "#type-declarations/runtime-ex"

import {
    TIMINGS,
    TIMING_UNSET,
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
import { NIL, UNDEF } from "../constants"
import { getSubscription } from "./schedule"
import { any } from "../../util/shared/sundry"
import { EffectOrWatchHasNoDependecies } from "../messages/warn"
import { getLastElem, swapDelete } from "../../util/shared/arrays"

export const [watch, preWatch, postWatch, syncWatch] = watchEffectFuncGen()
export const [effect, preEffect, postEffect, syncEffect] = reactiveEffectFuncGen()

export function markActiveEffectNoCheck() {
    if (activeEffect) {
        activeEffect.l |= EFFECT_NO_CHECK
    }
}

export function renderEffect(fn: GeneralEffectFunc) {
    return createEffect(EFFECT_RENDER, TIMING_UNSET, fn)
}

export function derivedEffect(fn: ArbitraryFunc) {
    return createEffect(EFFECT_DERIVED | EFFECT_DERIVED_DIRTY, TIMING_SYNC, fn)
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
    const destructionEffects = effect.d?.e
    if (!byDestruction && effect.x >= 0 && destructionEffects?.length) {
        getLastElem(destructionEffects)!.x = effect.x
        swapDelete(destructionEffects, effect.x)
    }
    effect.c?.()
    effect.c = NIL
    if (effect.k.length) {
        unlink(effect)
    }
    effect.x = -1
    effect.d = NIL
    effect.m = NIL
    effect.v = UNDEF
    effect.l |= EFFECT_DISABLED | EFFECT_DISPOSED
}

function createEffect(
    flag: number,
    timing: number,
    fn: ArbitraryFunc,
    watchCallback?: WatchEffectCallback<any>
): Effect {
    const effect: Effect = {
        f: fn,
        k: [],
        x: -1,
        c: NIL,
        l: flag,
        t: timing,
        d: currentDestruction,
        i: getIncrementEffectId(),
        m: flag & EFFECT_RENDER ? currentInstance : NIL
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
    if (checkAndDestroyInvalidEffect(effect) && currentDestruction) {
        const effects = (currentDestruction.e ??= [])
        effect.x = effects.length
        effects.push(effect)
    }

    return effect
}

function watchEffectFuncGen() {
    return TIMINGS.map<CreateWatcher>(timing => {
        return <T>(getter: Getter<T>, callback: WatchEffectCallback<T>) => {
            return createEffectWithHandle(EFFECT_WATCH, timing, getter, callback)
        }
    })
}

function reactiveEffectFuncGen() {
    return TIMINGS.map<CreateEffect>(timing => {
        return (callback: GeneralEffectFunc) => createEffectWithHandle(0, timing, callback)
    })
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

    let res: any
    const componentInstance = currentInstance
    const parentDestruction = currentDestruction
    setCurrentDestruction(effect.d)
    if (effect.m) {
        setCurrentInstance(effect.m)
    }

    try {
        res = (effect.l & EFFECT_WATCH ? effect.g! : effect.f)()
    } finally {
        popRunningEffectStack()
        setCurrentInstance(componentInstance)
        setCurrentDestruction(parentDestruction)
    }

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
        const isWatch = effect.l & EFFECT_WATCH
        const isDerived = effect.l & EFFECT_DERIVED
        disposeEffect(effect)
        EffectOrWatchHasNoDependecies(
            isWatch || isDerived ? effect.g! : effect.f,
            isWatch ? "watcher" : effect.l & EFFECT_DERIVED ? "derived reactive value" : ""
        )
    }
    return isValid
}

function createEffectWithHandle(...args: Parameters<typeof createEffect>): EffectHandle {
    const effect = createEffect(...args)
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
