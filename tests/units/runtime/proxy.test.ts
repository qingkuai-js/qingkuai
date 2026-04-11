import {
    react,
    constReact,
    shallowReact,
    shallowConstReact,
    destructuringReact,
    destructuringShallowReact,
    destructuringShallowConstReact
} from "../../../src/runtime/reactivity/value"
import { describe, expect, test } from "vitest"
import { NOOP } from "../../../src/runtime/constants"
import { toRaw } from "../../../src/util/runtime/sundry"
import { arrayFrom } from "../../../src/util/shared/arrays"
import { isFunction } from "../../../src/util/shared/assert"
import { isReactive } from "../../../src/util/runtime/assert"
import { proxyCache } from "../../../src/runtime/reactivity/value"

describe("Not destructuring", () => {
    test("Creating without setter for debugging", () => {
        const nil = react(null)
        const cnil = constReact(null)
        const undef = react(undefined)
        const cundef = constReact(undefined)
        expect(cnil).toBeNull()
        expect(nil.$).toBeNull()
        expect(cundef).toBeUndefined()
        expect(undef.$).toBeUndefined()
        expect(isReactive(nil)).toBeTruthy()
        expect(isReactive(undef)).toBeTruthy()

        const fn = react(() => {})
        const cfn = constReact(() => {})
        expect(isReactive(fn)).toBeTruthy()
        expect(isFunction(cfn)).toBeTruthy()
        expect(isFunction(fn.$)).toBeTruthy()

        const obj = react({ v: 1 })
        const cobj = constReact({ v: 1 })
        const sobj = shallowReact({ v: 1 })
        expect(cobj).toEqual({ v: 1 })
        expect(obj.$).toEqual({ v: 1 })
        expect(sobj.$).toEqual({ v: 1 })
        expect(isReactive(obj)).toBeTruthy()
        expect(isReactive(cobj)).toBeTruthy()
        expect(isReactive(sobj)).toBeTruthy()
        expect(isReactive(obj.$)).toBeTruthy()
        expect(isReactive(sobj.$)).toBeFalsy()
        expect(proxyCache.has(obj.$)).toBeFalsy()
        expect(proxyCache.has(toRaw(obj.$))).toBeTruthy()
        expect(proxyCache.has(toRaw(sobj.$))).toBeFalsy()

        const mapKey = {}
        const map = react(new Map([[mapKey, { v: 1 }]]))
        const entries = arrayFrom(map.$.entries())
        map.$.forEach((v: any, k: any, r: any) => {
            expect(r).toBe(map.$)
            expect(isReactive(k)).toBeTruthy()
            expect(isReactive(v)).toBeTruthy()
            expect(isReactive(r)).toBeTruthy()
        })
        expect(map.$.size).toBe(1)
        expect(entries).toEqual([[{}, { v: 1 }]])
        expect(map.$.get(mapKey)).toEqual({ v: 1 })
        expect(isReactive(map.$.get(mapKey))).toBeTruthy()
        expect(arrayFrom(map.$.values())).toEqual([{ v: 1 }])
        expect(proxyCache.has(map.$.get(mapKey))).toBeFalsy()
        expect(isReactive(arrayFrom(map.$.values())[0])).toBeTruthy()
        expect(proxyCache.has(toRaw(map.$.get(mapKey)))).toBeTruthy()
        expect(entries.map((item: any) => item.map(isReactive))).toEqual([[true, true]])
    })

    test("Creating with setter for debugging", () => {
        const [wnil, nil] = react(null, NOOP)
        const [wundef, undef] = react(undefined, NOOP)
        expect(nil).toBeNull()
        expect(wnil.$).toBeNull()
        expect(undef).toBeUndefined()
        expect(wundef.$).toBeUndefined()
        expect(isReactive(wnil)).toBeTruthy()
        expect(isReactive(wundef)).toBeTruthy()

        const [wfn, fn] = react(() => {}, NOOP)
        expect(toRaw(wfn.$)).toBe(fn)
        expect(isReactive(fn)).toBeFalsy()
        expect(isFunction(fn)).toBeTruthy()
        expect(isReactive(wfn)).toBeTruthy()
        expect(isFunction(wfn.$)).toBeTruthy()

        const [wobj, obj] = react({ v: 1 }, NOOP)
        const [swobj, sobj] = shallowReact({ v: 1 }, NOOP)
        expect(obj).toBe(toRaw(wobj.$))
        expect(sobj).toBe(toRaw(swobj.$))
        expect(wobj.$).toEqual({ v: 1 })
        expect(swobj.$).toEqual({ v: 1 })
        expect(isReactive(obj)).toBeFalsy()
        expect(isReactive(sobj)).toBeFalsy()
        expect(isReactive(wobj)).toBeTruthy()
        expect(isReactive(swobj)).toBeTruthy()
    })

    test("Whether debugging setter works", () => {
        let [wfn, fn] = shallowReact(
            () => {},
            v => (fn = v)
        )
        let [wnil, nil] = react(null, v => (nil = v))
        let [wobj, obj] = react({ v: 1 }, v => (obj = v))
        let [wset, set] = react(new Set(), v => (set = v))
        let [wmap, map] = react(new Map(), v => (map = v))
        let [wundef, undef] = shallowReact(undefined, v => (undef = v))
        expect(nil).toBeNull()
        expect(undef).toBeUndefined()
        expect(obj).toEqual({ v: 1 })
        expect(obj).toBe(toRaw(wobj.$))
        expect(wobj.$).toEqual({ v: 1 })
        expect(isFunction(fn)).toBeTruthy()

        wnil.$ = 1
        expect(nil).toBe(1)

        wundef.$ = []
        expect(undef).toEqual([])
        expect(undef).toBe(toRaw(wundef.$))

        wfn.$ = Object.prototype.toString
        expect(fn).toBe(Object.prototype.toString)

        wobj.$.v++
        expect(obj.v).toBe(2)
        expect(wobj.$.v).toBe(2)
        expect(obj).toBe(toRaw(wobj.$))

        wobj.$ = {}
        expect(obj).toEqual({})
        expect(wobj.$).toEqual({})
        expect(obj).toBe(toRaw(wobj.$))

        wset.$.add(1)
        expect(set.size).toBe(1)
        expect(wset.$.size).toBe(1)
        expect(set.has(1)).toBeTruthy()
        expect(wset.$.has(1)).toBeTruthy()

        wset.$ = new Set()
        expect(set.size).toBe(0)
        expect(wset.$.size).toBe(0)
        expect(set).toBe(toRaw(wset.$))

        wmap.$.set(1, 2)
        expect(map.size).toBe(1)
        expect(map.get(1)).toBe(2)
        expect(wmap.$.size).toBe(1)
        expect(wmap.$.get(1)).toBe(2)

        wmap.$ = new Map([[3, 4]])
        expect(map.size).toBe(1)
        expect(map.get(3)).toBe(4)
        expect(wmap.$.size).toBe(1)
        expect(wmap.$.get(3)).toBe(4)
        expect(map.has(1)).toBeFalsy()
        expect(wmap.$.has(1)).toBeFalsy()
    })

    test("Creating with reactive value", () => {
        for (let i = 0; i < 4; i++) {
            const reactFn1 = i === 0 || i === 2 ? react : constReact
            const reactFn2 = i === 0 || i === 3 ? react : constReact
            const reactive1 = reactFn1(i % 2 ? { v: 1 } : [1, 2, 3])
            const reactive2 = reactFn2(reactFn1 === react ? reactive1.$ : reactive1)
            expect(isReactive(reactive1)).toBeTruthy()
            expect(isReactive(reactive2)).toBeTruthy()

            if (reactFn1 === react) {
                expect(isReactive(reactive1.$)).toBeTruthy()
                expect(proxyCache.has(reactive1.$)).toBeFalsy()
                expect(proxyCache.has(toRaw(reactive1.$))).toBeTruthy()
                if (reactFn2 !== react) {
                    expect(reactive1.$).toBe(reactive2)
                    expect(reactive1.$ === reactive2).toBeTruthy()
                }
            }

            if (reactFn2 === react) {
                expect(isReactive(reactive2.$)).toBeTruthy()
                expect(proxyCache.has(reactive2.$)).toBeFalsy()
                expect(proxyCache.has(toRaw(reactive2.$))).toBeTruthy()
                if (reactFn1 !== react) {
                    expect(reactive1).toBe(reactive2.$)
                    expect(reactive1 === reactive2.$).toBeTruthy()
                }
            }

            if (reactFn1 === react && reactFn2 === react) {
                expect(reactive1 === reactive2).toBeFalsy()
                expect(reactive1.$ === reactive2.$).toBeTruthy()
            }
        }
    })
})

describe("Destructuring", () => {
    test("Creating without setter for debugging", () => {
        const [a, b] = destructuringReact(({ a, c: b }) => [a, 1, b, 1], { a: 1, c: 2 })
        expect([a.$, b.$]).toEqual([1, 2])
        expect(isReactive(a)).toBeTruthy()
        expect(isReactive(b)).toBeTruthy()

        const [c, d, e] = destructuringReact(([c, d, e]) => [c, 1, d, 1, e, 1], [1, 2])
        expect(isReactive(c)).toBeTruthy()
        expect(isReactive(d)).toBeTruthy()
        expect(isReactive(e)).toBeTruthy()
        expect([c.$, d.$, e.$]).toEqual([1, 2, undefined])

        const [obj, arr] = destructuringShallowReact(({ obj, arr }) => [obj, 1, arr, 0], {
            obj: { v: 1 },
            arr: [1, 2]
        })
        expect(arr).toEqual([1, 2])
        expect(obj.$).toEqual({ v: 1 })
        expect(isReactive(arr)).toBeFalsy()
        expect(isReactive(obj.$)).toBeFalsy()
    })

    test("Creating with setter for debugging", () => {
        const [[wa, a], [wb, b]] = destructuringReact(({ a, b }) => [a, 1, b, 1], { a: 1, b: 2 }, [
            NOOP,
            NOOP
        ])
        expect([a, b]).toEqual([1, 2])
        expect(isReactive(wa)).toBeTruthy()
        expect(isReactive(wb)).toBeTruthy()
        expect([wa.$, wb.$]).toEqual([1, 2])

        const [[wc, c], [wd, d]] = destructuringReact(
            ([c, d]) => [c, 1, d, 1],
            [3, 4],
            [NOOP, NOOP]
        )
        expect([c, d]).toEqual([3, 4])
        expect(isReactive(wc)).toBeTruthy()
        expect(isReactive(wd)).toBeTruthy()
        expect([wc.$, wd.$]).toEqual([3, 4])

        const [[wobj, obj], [warr, arr]] = destructuringShallowReact(
            ({ obj, arr }) => [obj, 1, arr, 1],
            { obj: { v: 1 }, arr: [1, 2] },
            [NOOP, NOOP]
        )
        expect(arr).toEqual([1, 2])
        expect(obj).toEqual({ v: 1 })
        expect(warr.$).toEqual([1, 2])
        expect(wobj.$).toEqual({ v: 1 })
    })

    test("Whether debugging setters work", () => {
        let [[wa, a], [wb, b]] = destructuringReact(({ a, b }) => [a, 1, b, 1], { a: 1, b: 2 }, [
            v => (a = v),
            v => (b = v)
        ])
        wa.$ -= wb.$ += 2
        expect([a, wa.$, b, wb.$]).toEqual([-3, -3, 4, 4])

        let [[wc, c], [wd, d]] = destructuringReact(
            ([c, d]) => [c, 1, d, 1],
            [3, 4],
            [v => (c = v), v => (d = v)]
        )
        wc.$ *= wd.$ /= 2
        expect([c, wc.$, d, wd.$]).toEqual([6, 6, 2, 2])

        let [[wobj, obj], [warr, arr]] = destructuringShallowReact(
            ({ obj, arr }) => [obj, 1, arr, 1],
            { obj: { v: 1 }, arr: [1, 2] },
            [v => (obj = v), v => (arr = v)]
        )
        wobj.$ = [3, 4]
        warr.$ = { v: 3 }
        expect(obj).toEqual([3, 4])
        expect(arr).toEqual({ v: 3 })
    })

    test("Creating with reactive value", () => {
        const reactive1 = react({ v: 1 })
        const [reactive2] = destructuringReact(({ r }) => [r, 1], { r: reactive1.$ })
        expect(reactive2.$).toEqual({ v: 1 })
        expect(isReactive(reactive1)).toBeTruthy()
        expect(isReactive(reactive2)).toBeTruthy()
        expect(proxyCache.has(reactive1.$)).toBeFalsy()
        expect(reactive1.$ === reactive2.$).toBeTruthy()
        expect(proxyCache.has(toRaw(reactive1.$))).toBeTruthy()
    })
})

test("The attached property for Set and Map should be reactive", () => {
    const set = react(new Set())
    const map = constReact(new Map())
    const shallowSet = shallowConstReact(new Set())
    map.custom = []
    set.$.custom = {}
    shallowSet.custom = {}
    expect(isReactive(map.custom)).toBeTruthy()
    expect(isReactive(set.$.custom)).toBeTruthy()
    expect(isReactive(shallowSet.custom)).toBeFalsy()
})

test("The shallow reactive value is different from the non-shallow one", () => {
    const a = react([1, 2, 3])
    const b = constReact(toRaw(a))
    const c = shallowReact(toRaw(a))
    const d = shallowConstReact(toRaw(a))
    const [e] = destructuringShallowConstReact(({ v }) => [v, 1], { v: toRaw(a) })
    for (const item of [a, b, c, d, e]) {
        expect(isReactive(item)).toBeTruthy()
    }
    expect(d).toBe(e)
    expect(a.$).toBe(b)
    expect(c.$).toBe(toRaw(a))
    expect(b !== d).toBeTruthy()
    expect(b !== c.$).toBeTruthy()
    expect(a.$ !== d).toBeTruthy()
    expect(a.$ !== c.$).toBeTruthy()
    expect(isReactive(c.$)).toBeFalsy()
})
