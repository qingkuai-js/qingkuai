import {
    watch,
    effect,
    syncWatch,
    postWatch,
    preWatch,
    preEffect,
    postEffect,
    syncEffect,
    renderEffect,
    disposeEffect
} from "../../../src/runtime/reactivity/effect"
import {
    WRAPPER,
    TIMING_PRE,
    TIMING_POST,
    TIMING_SYNC,
    ITERATOR_KEYS,
    TIMING_UNSET,
    EFFECT_DISABLED,
    EFFECT_DISPOSED
} from "../../../src/runtime/reactivity/constants"
import {
    sleep,
    initDestruction,
    getErrorMessage,
    getCurrentEffect
} from "../../../src/util/testing/sundry"
import { NOOP } from "../../../src/runtime/constants"
import { checkEffectDependaceManager } from "./_match"
import { isReactive } from "../../../src/util/runtime/assert"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { matchGlobalError } from "../../../src/util/testing/match"
import { isArray, isNumber } from "../../../src/util/shared/assert"
import { arrayFrom, emptyArr } from "../../../src/util/shared/arrays"
import { createWarningMatcher } from "../../../src/util/testing/sundry"
import { constReact, react } from "../../../src/runtime/reactivity/value"
import { MaximumUpdateDepthExceeded } from "../../../src/runtime/messages/error"
import { getRefProperty, toRaw, nextTick } from "../../../src/util/runtime/sundry"
import { backToParentDestruction, currentDestruction } from "../../../src/runtime/state"
import { createDestruction, destroy, pushDestructionCleaner } from "../../../src/runtime/destroy"

const arr: any[] = []
const invokeMarker = vi.fn()
const warningMatcher = createWarningMatcher()
const watchEffectFuncs = [watch, preWatch, postWatch, syncWatch]
const reactiveEffectFuncs = [effect, preEffect, postEffect, syncEffect]
const timings = [TIMING_UNSET, TIMING_PRE, TIMING_POST, TIMING_SYNC]

const cleanup = () => {
    emptyArr(arr)
    invokeMarker.mockClear()
    warningMatcher.mockClear()
}

initDestruction()
beforeEach(cleanup)

function makeConsecutiveNumbersArr(length: number) {
    return arrayFrom({ length }, (_, i) => i)
}

test("destroy should disconnect destruction from parent/effects", () => {
    const parent = currentDestruction!
    const nested = createDestruction()
    const cleaner = vi.fn()
    pushDestructionCleaner(cleaner)

    const nestedEffect = renderEffect(NOOP)

    createDestruction()
    const nestedChildEffect = renderEffect(NOOP)

    backToParentDestruction()
    backToParentDestruction()

    expect(currentDestruction).toBe(parent)
    expect(parent.c?.includes(nested)).toBeTruthy()

    destroy(nested, false)

    expect(cleaner).toHaveBeenCalledTimes(1)
    expect(nestedEffect.d).toBeNull()
    expect(nestedChildEffect.d).toBeNull()
    expect(parent.c?.includes(nested)).toBeFalsy()
    expect(nested.f).toBe(0)
    expect(nested.e).toBeNull()
    expect(nested.c).toBeNull()
    expect(nested.l).toBeNull()
    expect(nested.m).toBeNull()
    expect(nested.p).toBeNull()
    expect(nested.s).toBeNull()
    expect(nested.n).toBeNull()
    expect(currentDestruction).toBe(parent)
})

test("Functions of render effect", async () => {
    const value = react(1)
    const effect = renderEffect(() => {
        arr.push(value.$)
        return invokeMarker
    })
    expect(arr).toEqual([1])

    checkEffectDependaceManager(effect, {
        destroyed: false,
        timing: TIMING_UNSET,
        cleaner: invokeMarker,
        dependencies: [value],
        destruction: currentDestruction
    })

    value.$++
    await nextTick()
    expect(arr).toEqual([1, 2])
    expect(invokeMarker).toHaveBeenCalledTimes(1)

    disposeEffect(effect)
    expect(invokeMarker).toHaveBeenCalledTimes(2)
    expect(effect.l & EFFECT_DISABLED).toBeTruthy()
    expect(effect.l & EFFECT_DISPOSED).toBeTruthy()
    expect(currentDestruction!.e!.includes(effect)).toBeFalsy()

    --value.$
    await nextTick()
    expect(arr).toEqual([1, 2])
    expect(invokeMarker).toHaveBeenCalledTimes(2)
})

test("Functions of reactive effect", async () => {
    for (let i = 0; i < reactiveEffectFuncs.length; cleanup(), i++) {
        const value = react(1)
        const handle = reactiveEffectFuncs[i](() => {
            arr.push(value.$)
            return invokeMarker
        })
        expect(arr).toEqual([1])

        const effect = getCurrentEffect()!
        checkEffectDependaceManager(effect, {
            destroyed: false,
            timing: timings[i],
            cleaner: invokeMarker,
            dependencies: [value],
            destruction: currentDestruction
        })

        value.$++
        if (i !== 3) {
            await nextTick()
        }
        expect(arr).toEqual([1, 2])
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        handle.pause()
        expect(invokeMarker).toHaveBeenCalledTimes(1)
        expect(effect.l & EFFECT_DISPOSED).toBeFalsy()
        expect(effect.l & EFFECT_DISABLED).toBeTruthy()
        expect(currentDestruction!.e!.includes(effect)).toBeTruthy()

        value.$--
        if (i !== 3) {
            await nextTick()
        }
        expect(arr).toEqual([1, 2])
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        handle.resume()
        expect(effect.l & EFFECT_DISABLED).toBeFalsy()
        expect(effect.l & EFFECT_DISPOSED).toBeFalsy()

        value.$ *= 10
        if (i !== 3) {
            await nextTick()
        }
        expect(arr).toEqual([1, 2, 10])
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        handle.stop()
        expect(invokeMarker).toHaveBeenCalledTimes(3)
        expect(effect.l & EFFECT_DISABLED).toBeTruthy()
        expect(effect.l & EFFECT_DISPOSED).toBeTruthy()
        expect(currentDestruction!.e!.includes(effect)).toBeFalsy()

        value.$ += 10
        if (i !== 3) {
            await nextTick()
        }
        expect(arr).toEqual([1, 2, 10])
        expect(invokeMarker).toHaveBeenCalledTimes(3)

        handle.resume()
        expect(invokeMarker).toHaveBeenCalledTimes(3)
        expect(effect.l & EFFECT_DISABLED).toBeTruthy()
        expect(effect.l & EFFECT_DISABLED).toBeTruthy()
        expect(currentDestruction!.e!.includes(effect)).toBeFalsy()

        value.$ /= 10
        if (i !== 3) {
            await nextTick()
        }
        expect(arr).toEqual([1, 2, 10])
        expect(invokeMarker).toHaveBeenCalledTimes(3)
    }
})

test("Functions of watch effect", async () => {
    for (let i = 0; i < watchEffectFuncs.length; cleanup(), i++) {
        let pre: any = undefined
        let cur: any = undefined
        const map = constReact(new Map([[1, 99]]))

        const handle = watchEffectFuncs[i](
            () => map.get(1),
            (p, c) => {
                ;[pre, cur] = [p, c]
                return invokeMarker
            }
        )
        expect(arr.length).toBe(0)
        expect(pre).toBeUndefined()
        expect(cur).toBeUndefined()

        const effect = getCurrentEffect()!
        checkEffectDependaceManager(effect, {
            cleaner: null,
            destroyed: false,
            timing: timings[i],
            dependencies: [[map, 1]],
            destruction: currentDestruction
        })

        map.set(1, map.get(1) + 1)
        if (i !== 3) {
            await nextTick()
        }
        expect(pre).toBe(99)
        expect(cur).toBe(100)
        expect(arr.length).toBe(0)
        expect(effect.c).toBe(invokeMarker)
        expect(invokeMarker).toHaveBeenCalledTimes(0)

        map.set(1, 97)
        if (i !== 3) {
            await nextTick()
        }
        expect(pre).toBe(100)
        expect(cur).toBe(97)
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        handle.pause()
        expect(invokeMarker).toHaveBeenCalledTimes(1)
        expect(effect.l & EFFECT_DISPOSED).toBeFalsy()
        expect(effect.l & EFFECT_DISABLED).toBeTruthy()
        expect(currentDestruction!.e!.includes(effect)).toBeTruthy()

        map.set(1, 0)
        if (i !== 3) {
            await nextTick()
        }
        expect(pre).toBe(100)
        expect(cur).toBe(97)
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        handle.resume()
        expect(invokeMarker).toHaveBeenCalledTimes(1)
        expect(effect.l & EFFECT_DISPOSED).toBeFalsy()
        expect(effect.l & EFFECT_DISABLED).toBeFalsy()
        expect(currentDestruction!.e!.includes(effect)).toBeTruthy()

        map.set(1, map.get(1) - 1)
        if (i !== 3) {
            await nextTick()
        }
        expect(pre).toBe(97)
        expect(cur).toBe(-1)
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        handle.stop()
        expect(invokeMarker).toHaveBeenCalledTimes(3)
        expect(effect.l & EFFECT_DISPOSED).toBeTruthy()
        expect(effect.l & EFFECT_DISABLED).toBeTruthy()
        expect(currentDestruction!.e!.includes(effect)).toBeFalsy()

        map.set(1, -99)
        if (i !== 3) {
            await nextTick()
        }
        expect(pre).toBe(97)
        expect(cur).toBe(-1)
        expect(invokeMarker).toHaveBeenCalledTimes(3)

        handle.resume()
        expect(invokeMarker).toHaveBeenCalledTimes(3)
        expect(effect.l & EFFECT_DISPOSED).toBeTruthy()
        expect(effect.l & EFFECT_DISABLED).toBeTruthy()
        expect(currentDestruction!.e!.includes(effect)).toBeFalsy()
    }
})

test("Running sequence of different effects", async () => {
    const value = react(0)
    ;[postEffect, renderEffect, preEffect, syncEffect, renderEffect, preEffect, postEffect].forEach(
        (fn, index) => {
            fn(() => {
                value.$ && arr.push(1 + index)
            })
        }
    )
    ;[preWatch, postWatch, syncWatch, watch, postWatch, watch, preWatch, syncWatch].forEach(
        (fn, index) => {
            fn(
                () => value.$,
                () => {
                    arr.push(-1 - index)
                }
            )
        }
    )
    value.$++
    await nextTick()
    expect(arr).toEqual([4, -3, -8, 3, 6, -1, -7, 2, 5, -4, -6, 1, 7, -2, -5])
})

test("Functions of effect that depend on Set", async () => {
    const set = constReact(new Set([1, 2, 3]))
    const effect = renderEffect(() => {
        arr.push(set.size)
        return invokeMarker
    })
    expect(arr).toEqual([3])

    checkEffectDependaceManager(effect, {
        destroyed: false,
        timing: TIMING_UNSET,
        cleaner: invokeMarker,
        destruction: currentDestruction,
        dependencies: [[set, getRefProperty(set[WRAPPER].l, "size")]]
    })

    set.add(1)
    await nextTick()
    expect(arr).toEqual([3])
    expect(invokeMarker).toHaveBeenCalledTimes(0)

    set.delete(4)
    await nextTick()
    expect(arr).toEqual([3])
    expect(invokeMarker).toHaveBeenCalledTimes(0)

    set.add(4)
    await nextTick()
    expect(arr).toEqual([3, 4])
    expect(invokeMarker).toHaveBeenCalledTimes(1)

    set.delete(1)
    await nextTick()
    expect(arr).toEqual([3, 4, 3])
    expect(invokeMarker).toHaveBeenCalledTimes(2)

    set.add("size")
    await nextTick()
    expect(arr).toEqual([3, 4, 3, 4])
    expect(invokeMarker).toHaveBeenCalledTimes(3)

    disposeEffect(effect)
    cleanup()

    // attached property should not be influenced by internal data
    renderEffect(() => {
        invokeMarker()
        arr.push(set.custom)
    })
    expect(arr).toEqual([undefined])
    expect(invokeMarker).toHaveBeenCalledTimes(1)

    set.custom = null
    await nextTick()
    expect(arr).toEqual([undefined, null])
    expect(invokeMarker).toHaveBeenCalledTimes(2)

    set.add("custom")
    await nextTick()
    expect(invokeMarker).toHaveBeenCalledTimes(2)
})

test("Functions of effect that depend on Map", async () => {
    const map = constReact(new Map())
    const effect1 = renderEffect(() => {
        arr.push(map.size)
        return invokeMarker
    })
    const effect2 = renderEffect(() => {
        arr.push(map.get(1))
        return invokeMarker
    })
    expect(arr).toEqual([0, undefined])

    checkEffectDependaceManager(effect1, {
        destroyed: false,
        timing: TIMING_UNSET,
        cleaner: invokeMarker,
        destruction: currentDestruction,
        dependencies: [[map, getRefProperty(map[WRAPPER].l, "size")]]
    })
    checkEffectDependaceManager(effect2, {
        destroyed: false,
        timing: TIMING_UNSET,
        cleaner: invokeMarker,
        dependencies: [[map, 1]],
        destruction: currentDestruction
    })

    map.delete(1)
    await nextTick()
    expect(arr).toEqual([0, undefined])
    expect(invokeMarker).toHaveBeenCalledTimes(0)

    map.set(1, 99)
    await nextTick()
    expect(arr).toEqual([0, undefined, 1, 99])
    expect(invokeMarker).toHaveBeenCalledTimes(2)

    map.set(1, 999)
    await nextTick()
    expect(invokeMarker).toHaveBeenCalledTimes(3)
    expect(arr).toEqual([0, undefined, 1, 99, 999])

    map.delete(1)
    await nextTick()
    expect(invokeMarker).toHaveBeenCalledTimes(5)
    expect(arr).toEqual([0, undefined, 1, 99, 999, 0, undefined])

    map.set("size", "")
    await nextTick()
    expect(invokeMarker).toHaveBeenCalledTimes(6)
    expect(arr).toEqual([0, undefined, 1, 99, 999, 0, undefined, 1])

    disposeEffect(effect1)
    map.clear()
    cleanup()

    // attached property should not be influenced by internal data
    renderEffect(() => {
        invokeMarker()
        arr.push(map.custom)
    })
    expect(arr).toEqual([undefined])
    expect(invokeMarker).toHaveBeenCalledTimes(1)

    map.custom = null
    await nextTick()
    expect(arr).toEqual([undefined, null])
    expect(invokeMarker).toHaveBeenCalledTimes(2)

    map.set("custom", "")
    await nextTick()
    expect(arr).toEqual([undefined, null])
    expect(invokeMarker).toHaveBeenCalledTimes(2)
})

test("Modify the length property of Array", () => {
    const nums = constReact([1, 2, 3])
    syncEffect(() => {
        invokeMarker()
        arr.push(nums[2])
    })
    expect(arr).toEqual([3])
    expect(invokeMarker).toHaveBeenCalledTimes(1)

    nums.length = 4
    expect(arr).toEqual([3])
    expect(invokeMarker).toHaveBeenCalledTimes(1)

    nums.length = 2
    expect(arr).toEqual([3, undefined])
    expect(invokeMarker).toHaveBeenCalledTimes(2)

    nums.push(3)
    expect(arr).toEqual([3, undefined, 3])
    expect(invokeMarker).toHaveBeenCalledTimes(3)

    nums[2] = undefined
    expect(invokeMarker).toHaveBeenCalledTimes(4)
    expect(arr).toEqual([3, undefined, 3, undefined])

    nums.length = 0
    expect(invokeMarker).toHaveBeenCalledTimes(4)
    expect(arr).toEqual([3, undefined, 3, undefined])
})

test("Effect should not be re-run when the value has not been modified", async () => {
    for (const effectFunc of reactiveEffectFuncs) {
        const count = react(1)
        invokeMarker.mockClear()
        effectFunc(() => {
            count.$
            invokeMarker()
        })
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        count.$ = 1
        await nextTick()
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        const obj = {}
        count.$ = obj
        await nextTick()
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        count.$ = constReact(obj)
        await nextTick()
        expect(invokeMarker).toHaveBeenCalledTimes(2)
    }

    for (const watchFunc of watchEffectFuncs) {
        const obj = constReact({})
        invokeMarker.mockClear()
        watchFunc(
            () => {
                invokeMarker()
                return obj.a
            },
            () => {}
        )
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        const sub = constReact([])
        obj.a = sub
        await nextTick()
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        obj.a = toRaw(sub)
        await nextTick()
        expect(invokeMarker).toHaveBeenCalledTimes(2)
    }
})

test("Effect chains propagate only along their expected dependency paths", async () => {
    for (let i = 0; i < reactiveEffectFuncs.length; cleanup(), i++) {
        const obj = react({
            a: 1,
            b: 2
        })
        reactiveEffectFuncs[i](() => {
            arr.push(obj.$.a)
            return invokeMarker
        })
        reactiveEffectFuncs[i](() => {
            arr.push(obj.$)
            return invokeMarker
        })
        reactiveEffectFuncs[i](() => {
            arr.push(obj.$.b)
            return invokeMarker
        })

        const originRaw = toRaw(obj.$)
        expect(arr).toEqual([1, originRaw, 2])

        obj.$.a++
        if (i !== 3) {
            await nextTick()
        }
        expect(arr).toEqual([1, originRaw, 2, 2])
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        obj.$ = {
            a: 2,
            b: 99
        }
        if (i !== 3) {
            await nextTick()
        }
        expect(invokeMarker).toHaveBeenCalledTimes(4)
        expect(arr).toEqual([1, originRaw, 2, 2, 2, obj.$, 99])

        --obj.$.b
        if (i !== 3) {
            await nextTick()
        }
        expect(invokeMarker).toHaveBeenCalledTimes(5)
        expect(arr).toEqual([1, originRaw, 2, 2, 2, obj.$, 99, 98])
    }
})

test("Whether a runtime error will be caused when recursive update depth exceeds the maximum value", async () => {
    const errMsg = getErrorMessage(() => MaximumUpdateDepthExceeded())
    const stopGlobalErrorWatcher = matchGlobalError(errMsg, true)
    const v1 = react(0)
    for (let i = 0; i < 2; i++) {
        renderEffect(() => {
            if (v1.$ < 100) {
                arr.push(v1.$++)
            }
        })
    }
    expect(arr).toEqual([0, 1])

    await nextTick()
    expect(arr).toEqual([0, 1, 2])

    await nextTick()
    expect(arr).toEqual([0, 1, 2, 3])

    await sleep(100)
    expect(arr).toEqual(makeConsecutiveNumbersArr(100))

    const v2 = (cleanup(), react(0))
    for (let i = 0; i < 2; i++) {
        renderEffect(() => {
            arr.push(v2.$++)
        })
    }
    expect(arr).toEqual([0, 1])

    await sleep(100)
    stopGlobalErrorWatcher()
    expect(arr).toEqual(makeConsecutiveNumbersArr(303))
})

describe("Traversal operations of specified types are tracked as ITERATOR_KEYS dependencies", () => {
    test("Depend on Set", async () => {
        const set = constReact(new Set([1, 2, []]))
        renderEffect(() => {
            set.forEach((item: any, _: any, caller: any) => {
                if ((arr.push(item), isArray(item))) {
                    invokeMarker()
                    expect(isReactive(item)).toBeTruthy()
                }
                expect(caller).toBe(set)
            })
        })
        expect(arr).toEqual([1, 2, []])
        expect(set[WRAPPER].a.size).toBe(2)
        expect(invokeMarker).toHaveBeenCalledTimes(1)
        expect(set[WRAPPER].a.has(ITERATOR_KEYS)).toBeTruthy()

        set.add(3)
        await nextTick()
        expect(arr).toEqual([1, 2, [], 1, 2, [], 3])
        expect(invokeMarker).toHaveBeenCalledTimes(2)
        expect(set[WRAPPER].a.get(ITERATOR_KEYS).k.length).toBe(1)

        renderEffect(() => {
            for (const item of set) {
                if (isArray(item)) {
                    invokeMarker()
                    expect(isReactive(item)).toBeTruthy()
                }
            }
        })
        expect(invokeMarker).toHaveBeenCalledTimes(3)
        expect(set[WRAPPER].a.get(ITERATOR_KEYS).k.length).toBe(2)
    })

    test("Depend on Map", () => {
        const map = constReact(new Map())
        syncEffect(() => {
            map.forEach((value: any, key: any, caller: any) => {
                invokeMarker()
                arr.push([key, value])
                expect(caller).toBe(map)
                expect(isNumber(key) || isReactive(key)).toBeTruthy()
                expect(isNumber(value) || isReactive(value)).toBeTruthy()
            })
        })
        expect(invokeMarker).toHaveBeenCalledTimes(0)

        map.set(1, 2)
        expect(invokeMarker).toHaveBeenCalledTimes(1)
    })

    test("Depend on Array", async () => {
        const nums = constReact([1, 2, []])
        renderEffect(() => {
            nums.forEach((item: any, _: any, caller: any) => {
                if ((arr.push(item), isArray(item))) {
                    invokeMarker()
                    expect(isReactive(item)).toBeTruthy()
                }
                expect(caller).toBe(nums)
            })
        })
        expect(arr).toEqual([1, 2, []])
        expect(nums[WRAPPER].a.size).toBe(2)
        expect(invokeMarker).toHaveBeenCalledTimes(1)
        expect(nums[WRAPPER].a.has(ITERATOR_KEYS)).toBeTruthy()

        ++nums[0]
        await nextTick()
        expect(arr).toEqual([1, 2, [], 2, 2, []])
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        nums.push(99)
        await nextTick()
        expect(arr.slice(6)).toEqual([2, 2, [], 99])
        expect(invokeMarker).toHaveBeenCalledTimes(3)

        nums.pop()
        await nextTick()
        expect(arr.slice(10)).toEqual([2, 2, []])
        expect(invokeMarker).toHaveBeenCalledTimes(4)
        expect(nums[WRAPPER].a.get(ITERATOR_KEYS).k.length).toBe(1)

        renderEffect(() => {
            for (const item of nums) {
                if (isArray(item)) {
                    invokeMarker()
                    expect(isReactive(item)).toBeTruthy()
                }
            }
        })
        expect(invokeMarker).toHaveBeenCalledTimes(5)
        expect(nums[WRAPPER].a.get(ITERATOR_KEYS).k.length).toBe(2)
    })
})
