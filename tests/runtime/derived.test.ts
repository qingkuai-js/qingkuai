import type { Effect } from "#type-declarations/runtime"

import { len } from "../../src/util/shared/sundry"
import { currentDestruction } from "../../src/runtime/state"
import { constReact, react } from "../../src/runtime/internal"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { arrayFrom, emptyArr } from "../../src/util/shared/arrays"
import { createWarningMatcher } from "../../src/util/testing/sundry"
import { EFFECT_DERIVED, WRAPPER } from "../../src/runtime/reactivity/constants"
import { getCurrentEffect, initDestruction } from "../../src/util/testing/sundry"
import { derived, destructuringDerived } from "../../src/runtime/reactivity/derived"

const invokeMarker = vi.fn()
const warningMatcher = createWarningMatcher()

initDestruction()
beforeEach(() => {
    if (currentDestruction?.e) {
        emptyArr(currentDestruction.e)
    }
    invokeMarker.mockClear()
    warningMatcher.mockClear()
})

describe("Not destructuring", () => {
    test("Basic functions", () => {
        const a = react(1)
        const b = react(2)
        const value = derived(() => {
            invokeMarker()
            return a.$ + b.$
        })
        expect(invokeMarker).toHaveBeenCalledTimes(0)
        expect(value.$).toBe(3)
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        expect(value.$).toBe(3)
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        a.$++
        expect(value.$).toBe(4)
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        // Called times should not be increased when derived value is not dirty
        expect(value.$).toBe(4)
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        b.$++
        expect(value.$).toBe(5)

        a.$++
        b.$++
        expect(invokeMarker).toHaveBeenCalledTimes(3)

        expect(value.$).toBe(7)
        expect(invokeMarker).toHaveBeenCalledTimes(4)
    })

    test("Modifying is invalid", () => {
        const a = react(1)
        const value = derived(() => a.$)

        value.$++
        expect(value.$).toBe(1)
        expect(warningMatcher).toHaveBeenCalledTimes(1)
        expect(warningMatcher.args[1].startsWith("An assignment to the derived")).toBeTruthy()
    })

    test("Whether debugging setter works", () => {
        const a = react(3)
        const b = react(4)
        let [wd, d] = derived(
            () => {
                invokeMarker()
                return a.$ + b.$
            },
            v => (d = v)
        )
        expect(d).toBe(undefined)
        expect(wd).toEqual({ $: 7 })
        expect(d).toBe(7)
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        a.$++
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        expect(d).toBe(7)
        expect(wd.$).toBe(8)
        expect(d).toBe(8)
        expect(invokeMarker).toHaveBeenCalledTimes(2)
    })

    test("Check logic of derived value effect", () => {
        const value1 = derived(() => {})
        expect(value1.$).toBeUndefined()
        expect(getCurrentEffect()).toBeUndefined()
        expect(warningMatcher).toHaveBeenCalledTimes(1)
        expect(warningMatcher.args[1].includes("derived reactive value")).toBeTruthy()

        expect(value1.$).toBeUndefined()
        expect(warningMatcher).toHaveBeenCalledTimes(1)

        let valid = true
        let effect: Effect
        const a = react(1)
        const getter = () => {
            if ((invokeMarker(), valid)) {
                return a.$++
            }
            return -1
        }
        const value2 = derived(getter)
        expect(value2.$).toBe(1)
        expect(invokeMarker).toHaveBeenCalledTimes(1)
        expect(warningMatcher).toHaveBeenCalledTimes(1)
        expect(getCurrentEffect().l & EFFECT_DERIVED).toBeTruthy()

        a.$++
        expect(value2.$).toBe(3)
        expect(invokeMarker).toHaveBeenCalledTimes(2)
        expect(warningMatcher).toHaveBeenCalledTimes(1)

        a.$++
        valid = false
        effect = getCurrentEffect()
        expect(value2.$).toBe(-1)
        expect(getCurrentEffect()).toBeUndefined()
        expect(warningMatcher.args[2]).toBe(getter)
        expect(invokeMarker).toHaveBeenCalledTimes(3)
        expect(warningMatcher).toHaveBeenCalledTimes(2)
        expect(warningMatcher.args[1].includes("derived reactive value")).toBeTruthy()
    })

    test("Derived from another derived reactive value", () => {
        const a = react(1)
        const b = react(2)
        const d1 = derived(() => a.$ + b.$)
        const d2 = derived(() => d1.$ + a.$)
        expect(d1.$).toBe(3)
        expect(d2.$).toBe(4)
        expect(len(a[WRAPPER].s.k)).toBe(2)
        expect(len(b[WRAPPER].s.k)).toBe(2)

        const c = react(3)
        const d = react(4)
        const d3 = derived(() => c.$ + d.$)
        const d4 = derived(() => c.$ + d.$ + d3.$)
        expect(d3.$).toBe(7)
        expect(d4.$).toBe(14)
        expect(len(a[WRAPPER].s.k)).toBe(2)
        expect(len(b[WRAPPER].s.k)).toBe(2)
    })
})

describe("Destructuring", () => {
    test("Basic functions", () => {
        const a = react([1, 2])
        const b = constReact([3, 4])
        const d = derived(() => {
            invokeMarker()
            return a.$.concat(b)
        })
        expect(invokeMarker).toHaveBeenCalledTimes(0)
        expect(d.$).toEqual([1, 2, 3, 4])
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        a.$.push(99)
        expect(d.$).toEqual([1, 2, 99, 3, 4])
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        b.push(999)
        expect(d.$).toEqual([1, 2, 99, 3, 4, 999])
        expect(invokeMarker).toHaveBeenCalledTimes(3)

        b.pop()
        a.$.pop()
        expect(d.$).toEqual([1, 2, 3, 4])
        expect(invokeMarker).toHaveBeenCalledTimes(4)
    })

    test("Modifying is invalid", () => {
        const a = react(1)
        let [[wx, x], [wy, y]] = destructuringDerived(
            ({ x, y }) => [x, y],
            () => {
                return {
                    x: a.$,
                    y: a.$
                }
            },
            2,
            [v => (x = v), v => (y = v)]
        )
        expect([x, y]).toEqual([undefined, undefined])
        expect([wx.$, wy.$]).toEqual([1, 1])
        expect([x, y]).toEqual([1, 1])

        wx.$++
        expect(warningMatcher).toHaveBeenCalledTimes(1)
        expect(warningMatcher.args[1].startsWith("An assignment to the derived")).toBeTruthy()

        --wy.$
        expect(warningMatcher).toHaveBeenCalledTimes(2)
        expect(warningMatcher.args[1].startsWith("An assignment to the derived")).toBeTruthy()

        a.$ *= 10
        expect([wx.$, wy.$]).toEqual([10, 10])
        expect([x, y]).toEqual([10, 10])
    })

    test("Whether debugging setters work", () => {
        const a = constReact({ x: 1 })
        const b = react({ y: 2, z: 3 })
        let [[wx, x], [wy, y], [wz, z]] = destructuringDerived(
            ({ x, y, z }) => [x, y, z],
            () => {
                invokeMarker()
                return { ...a, ...b.$ }
            },
            3,
            [v => (x = v), v => (y = v), v => (z = v)]
        )

        const checkValues = (xyz: number[]) => {
            expect([wx, wy, wz]).toEqual(
                arrayFrom(
                    {
                        length: xyz.length
                    },
                    (_, i) => {
                        return { $: xyz[i] }
                    }
                )
            )
            expect([x, y, z]).toEqual(xyz)
        }

        expect([x, y, z]).toEqual(
            arrayFrom(
                {
                    length: 3
                },
                () => undefined
            )
        )
        expect(invokeMarker).toHaveBeenCalledTimes(0)

        checkValues([1, 2, 3])
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        a.x++
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        checkValues([2, 2, 3])
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        b.$.y--
        checkValues([2, 1, 3])
        expect(invokeMarker).toHaveBeenCalledTimes(3)

        a.x -= 10
        b.$.z += 10
        checkValues([-8, 1, 13])
        expect(invokeMarker).toHaveBeenCalledTimes(4)
    })
})
