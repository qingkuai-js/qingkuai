import type {
    Link,
    Effect,
    BaseEffect,
    EffectExtra,
    GeneralEffectFunc,
    WatchEffectCallback
} from "#type-declarations/runtime"
import type { ArbitraryFunc, Getter } from "#type-declarations/tools"

import {
    TIMINGS,
    TIMING_UNSET,
    TIMING_SYNC,
    EFFECT_WATCH,
    EFFECT_RENDER,
    EFFECT_DERIVED,
    EFFECT_DISPOSED,
    EFFECT_DISABLED,
    EFFECT_SCHEDULING,
    EFFECT_DERIVED_DIRTY,
    EFFECT_DERIVED_READING
} from "./constants"
import {
    activeEffect,
    getIncrementEffectId,
    popRunningEffectStack,
    pushRunninEffectStack
} from "./state"
import { NIL, UNDEF } from "../constants"
import { getSubscription } from "./schedule"
import { any, len } from "../../util/shared/sundry"
import { isUndefined } from "../../util/shared/assert"
import { objectAssign } from "../../util/shared/aliases"
import { isWatchEffect } from "../../util/runtime/assert"
import { currentInstance, currentDestruction } from "../state"
import { spliceByElem, swapDelete } from "../../util/shared/arrays"
import { WatchEffectDependantNoReactiveValue } from "../messages/warn"

export const [watch, preWatch, postWatch, syncWatch] = watchEffectFuncGen()
export const [effect, preEffect, postEffect, syncEffect] = reactiveEffectFuncGen()

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

    // 对于非监视器副作用：res 就是用户自定义的清理方法
    // For non-watcher effect: `res` is the user-defined cleanup function.

    // 对于监视器副作用：res 是监视目标的最新值，回调 effect.f 的返回值才是用户自定义的清理方法
    // For watcher effect: `res` is the latest value of the watched target,
    // `effect.f` is the callback, and its return value is the user-defined cleanup function.
    effect.c = (isWatchEffect(effect) ? effect.f(effect.v, (effect.v = res)) : res) || NIL

    checkAndDestroyInvalidEffect(effect)
}

export function appendLinksToActiveEffect(from: Effect) {
    if (!activeEffect || activeEffect.l & EFFECT_DISPOSED) {
        return
    }
    for (const link of from.k) {
        const isSync = any(activeEffect.t == TIMING_SYNC) // avoid a ts bug
        const toSub = getSubscription(link.s.w, link.s.p, isSync, true)!
        if (toSub.k[toSub.a]?.e !== activeEffect) {
            const newLink: Link = {
                e: activeEffect,
                s: toSub,
                l: link.l,
                i: len(toSub.k)
            }
            toSub.a = newLink.i
            toSub.k.push(newLink)
            activeEffect.k.push(newLink)
        }
    }
}

export function disposeEffect(effect: Effect, byDestruction = false) {
    if (!byDestruction && effect.d?.e) {
        spliceByElem(effect.d.e, effect, false)
    }
    effect.c?.()
    unlink(effect)
    effect.l |= EFFECT_DISABLED | EFFECT_DISPOSED
}

function createEffect(
    flag: number,
    timing: number,
    fn: ArbitraryFunc,
    watchCallback?: WatchEffectCallback<any>
): Effect {
    let extra: EffectExtra
    const notWatch = isUndefined(watchCallback)
    if (notWatch) {
        extra = {
            f: fn
        }
    } else {
        extra = {
            g: fn,
            v: UNDEF,
            f: watchCallback
        }
    }

    const effect: Effect = objectAssign<EffectExtra, BaseEffect>(extra, {
        k: [],
        c: NIL,
        l: flag,
        t: timing,
        d: currentDestruction,
        i: getIncrementEffectId(),
        m: flag & EFFECT_RENDER ? currentInstance : NIL
    })

    const res = runEffectCollector(effect)
    if (isWatchEffect(effect)) {
        effect.v = res
    } else if (res) {
        effect.c = res
    }

    // 将副作用记录到 Destruction
    // Record the effect onto `Destruction`
    if (checkAndDestroyInvalidEffect(effect) && currentDestruction) {
        ;(currentDestruction.e ??= []).push(effect)
    }

    return effect
}

function createEffectWithHandle(...args: Parameters<typeof createEffect>) {
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

function reactiveEffectFuncGen() {
    return TIMINGS.map(timing => {
        return (fn: GeneralEffectFunc) => createEffectWithHandle(0, timing, fn)
    })
}

function watchEffectFuncGen() {
    return TIMINGS.map(timing => {
        return <T>(getter: Getter<T>, callback: WatchEffectCallback<T>) => {
            return createEffectWithHandle(EFFECT_WATCH, timing, getter, callback)
        }
    })
}

function unlink(effect: Effect) {
    for (let i = 0, link = effect.k[0]; link; link = effect.k[++i]) {
        // 若 link 不处于 link.s.k 末尾，需要更新原来末尾元素的 i 属性
        // 例如：对于 [a, b, c, d]，删除 b 后变为 [a, d, c]，那么需要将 d.i 修改为 b.i
        //
        // If the `link` is not at the end of `link.s.k`, update the `i` property of the original tail element.
        // For example, given [a, b, c, d], removing `b` results in [a, d, c], so `d.i` needs to be updated to `b.i`.
        if ((swapDelete(link.s.k, link.i), link.i < len(link.s.k))) {
            link.s.k[link.i].i = link.i
        }
    }
}

function runEffectCollector(effect: Effect) {
    if (len(effect.k)) {
        unlink(effect)
        effect.k = []
    }
    pushRunninEffectStack(effect)

    const isWatch = isWatchEffect(effect)
    const res = (isWatch ? effect.g : effect.f)()
    if ((popRunningEffectStack(), len(effect.k))) {
        for (const link of effect.k) {
            if (activeEffect) {
                link.s.a--
            } else {
                link.s.a = -1
            }
        }
        if (activeEffect && !(effect.l & EFFECT_RENDER)) {
            appendLinksToActiveEffect(effect)
        }
    }
    return res
}

// 检查并卸载无效的副作用：未依赖任何响应式值的副作用永远不会被再次触发
// Check and dispose invalid effects: effects that do not depend on any reactive values will never be triggered again.
function checkAndDestroyInvalidEffect(effect: Effect) {
    if (effect.l & EFFECT_RENDER) {
        return true
    }

    let isValid = len(effect.k) > 0
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
        WatchEffectDependantNoReactiveValue(
            isWatchEffect(effect) ? effect.g : effect.f,
            isWatchEffect(effect)
                ? "watcher"
                : effect.l & EFFECT_DERIVED
                ? "derived reactive value"
                : ""
        )
    }
    return isValid
}
