import type {
    Effect,
    Subscription,
    ProxyWrapper,
    AccessorWrapper
} from "#type-declarations/runtime"
import type { ExpectedEffect } from "#type-declarations/testing"

import { expect } from "vitest"
import { isReactive } from "../../src/util/runtime/assert"
import { EFFECT_DISABLED, TIMING_SYNC, WRAPPER } from "../../src/runtime/reactivity/constants"

// 检查副作用与其他数据结构间的依赖关系
// Check dependance manager between the effect and other data struct
export function checkEffectDependaceManager(effect: Effect, expected: ExpectedEffect) {
    expect(effect.t).toBe(expected.timing)
    expect(effect.c).toBe(expected.cleaner)
    expect(effect.d).toBe(expected.destruction)

    const checkLink = (effect: Effect, sub: Subscription) => {
        expect(effect.k.map(link => link.s).includes(sub)).toBeTruthy()
        expect(sub.k.map(link => link.e).includes(effect)).toBeTruthy()
    }

    if (effect.d?.e) {
        expect(effect.d.e.includes(effect)).toBeTruthy()
    }
    if (expected.destroyed) {
        expect(effect.l & EFFECT_DISABLED).toBeTruthy()
    }
    for (const item of expected.dependencies || []) {
        const keyInWrapper = effect.t === TIMING_SYNC ? "s" : "a"
        if (isReactive(item)) {
            const wrapper = item[WRAPPER] as AccessorWrapper
            checkLink(effect, wrapper[keyInWrapper]!)
        } else {
            const [value, ...properties] = item
            const wrapper = value[WRAPPER] as ProxyWrapper
            for (const property of properties) {
                checkLink(effect, wrapper[keyInWrapper]!.get(property)!)
            }
        }
    }
}
