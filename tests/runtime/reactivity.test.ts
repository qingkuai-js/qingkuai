import type { FixedArray } from "../../util/types"
import type { EffectFunc, UpdateFunc, WatchFunc } from "../../runtime/types"

import {
    QingKuaiComponent,
    constReactivity,
    raw,
    reactivity,
    nextTick,
    derived,
    watch,
    effect
} from "../../runtime"
import { warnSpy } from "../vi"
import { optc } from "../../util/shared"
import { isReactive } from "../../util/runtime"
import { Wrapper } from "../../runtime/constants"
import { describe, test, expect, vi } from "vitest"
import { updateList } from "../../runtime/schedule"
import { clearUsedEffectList, usedEffectList } from "../../runtime/reactivity/state"

describe("test reactivity related methods", () => {
    test("Return value", () => {
        let ret: any
        const secondaryObj = { a: { b: 1 } }

        expect(constReactivity()).toEqual(undefined)
        expect(reactivity()).toEqual({ $: undefined })
        expect(constReactivity(1)).toBe(1)
        expect(reactivity(1)).toEqual({ $: 1 })
        expect(constReactivity("QingKuai")).toBe("QingKuai")
        expect(reactivity("QingKuai")).toEqual({ $: "QingKuai" })
        expect(optc(reactivity(() => {}).$)).toBe("Function")
        expect(optc(constReactivity(() => {}))).toBe("Function")
        expect(optc(reactivity([]).$)).toBe("Array")
        expect(optc(constReactivity([]))).toBe("Array")
        expect(optc(reactivity(new Set()).$)).toBe("Set")
        expect(optc(constReactivity(new Set()))).toBe("Set")
        expect(optc(reactivity(new Map()).$)).toBe("Map")
        expect(optc(constReactivity(new Map()))).toBe("Map")

        ret = reactivity(secondaryObj)
        expect(ret).toEqual({ $: { a: { b: 1 } } })
        expect(isReactive(ret)).toBe(true)
        expect(isReactive(ret.$)).toBe(true)
        expect(isReactive(ret.$.a)).toBe(true)

        ret = constReactivity(secondaryObj)
        expect(ret).toEqual(secondaryObj)
        expect(ret.$).toBeUndefined()
        expect(isReactive(ret)).toBe(true)
        expect(isReactive(ret.a)).toBe(true)

        ret = reactivity(secondaryObj, 1)
        expect(ret).toEqual({ $: secondaryObj })
        expect(isReactive(ret)).toBe(true)
        expect(isReactive(ret.$)).toBe(false)
        expect(isReactive(ret.$.a)).toBe(false)

        ret = constReactivity(secondaryObj, 1)
        expect(ret.$).toBeUndefined()
        expect(isReactive(ret)).toBe(false)
    })

    test("Effect on original target", () => {
        const obj = { a: 1 }
        const ret1 = reactivity(obj)
        const ret2 = reactivity(ret1.$)

        ret1.$.a++
        expect(obj.a).toBe(2)
        expect(ret1.$.a).toBe(2)
        expect(ret2.$.a).toBe(2)

        ret1.$.a += 10
        expect(obj.a).toBe(12)
        expect(ret1.$.a).toBe(12)
        expect(ret2.$.a).toBe(12)
    })

    test("Change level of reactive value", () => {
        let ret1: any, ret2: any
        const tertiaryObj = { a: { b: { c: 1 } } }

        // level down
        ret1 = reactivity(tertiaryObj)
        expect(ret1).toEqual({ $: tertiaryObj })
        expect(isReactive(ret1.$.a.b)).toBe(true)

        ret2 = reactivity(ret1.$, 2)
        expect(ret2).toEqual({ $: tertiaryObj })
        expect(isReactive(ret2)).toBe(true)
        expect(isReactive(ret2.$)).toBe(true)
        expect(isReactive(ret2.$.a)).toBe(false)
        expect(isReactive(ret2.$.a.b)).toBe(false)

        ret1 = constReactivity(tertiaryObj)
        expect(ret1).toEqual(tertiaryObj)
        expect(isReactive(ret1.a.b)).toBe(true)

        ret2 = constReactivity(ret1, 2)
        expect(ret2).toEqual(tertiaryObj)
        expect(isReactive(ret2)).toBe(true)
        expect(isReactive(ret2.a)).toBe(false)
        expect(isReactive(ret2.a.b)).toBe(false)

        ret1 = reactivity(tertiaryObj)
        ret2 = constReactivity(ret1.$, 1)
        expect(ret2).toEqual(tertiaryObj)
        expect(isReactive(ret2)).toBe(false)

        ret1 = constReactivity(tertiaryObj)
        ret2 = reactivity(ret1, 3)
        expect(ret2).toEqual({ $: tertiaryObj })
        expect(isReactive(ret2)).toBe(true)
        expect(isReactive(ret2.$)).toBe(true)
        expect(isReactive(ret2.$.a)).toBe(true)
        expect(isReactive(ret2.$.a.b)).toBe(false)

        // level up
        ret1 = reactivity(tertiaryObj, 0)
        expect(ret1).toEqual({ $: tertiaryObj })
        expect(isReactive(ret1)).toBe(false)

        ret2 = reactivity(ret1.$)
        expect(ret2).toEqual({ $: tertiaryObj })
        expect(isReactive(ret2)).toBe(true)
        expect(isReactive(ret2.$)).toBe(true)
        expect(isReactive(ret2.$.a)).toBe(true)
        expect(isReactive(ret2.$.a.b)).toBe(true)

        ret1 = constReactivity(tertiaryObj, 1)
        expect(ret1).toEqual(tertiaryObj)
        expect(isReactive(ret1)).toBe(false)

        ret2 = constReactivity(ret1, 2)
        expect(ret2).toEqual(tertiaryObj)
        expect(isReactive(ret2)).toBe(true)
        expect(isReactive(ret2.a)).toBe(false)

        ret2 = reactivity(ret1, 3)
        expect(ret2).toEqual({ $: tertiaryObj })
        expect(isReactive(ret2)).toBe(true)
        expect(isReactive(ret2.$)).toBe(true)
        expect(isReactive(ret2.$.a)).toBe(true)
        expect(isReactive(ret2.$.a.b)).toBe(false)
    })

    test("Whether different types of reactive function are normal", async () => {
        let ret: any
        const updateFunc: UpdateFunc = () => false
        updateFunc.instance = new QingKuaiComponent()

        // 方便获取响应性值的更新副总用的方法
        // a method to get effect of reactive value easiler
        const getEffect = () => ret[Wrapper].effect[0]

        ret = reactivity("")
        expect(ret).toEqual({ $: "" })

        // 更新副作用为空，这种情况下更新后updateList也应该为空
        // effect is empty, so it should not be added into updateList
        ret.$ = "."
        expect(updateList.size).toBe(0)

        // no change int ret
        getEffect().add(updateFunc)
        ret.$ = "."
        expect(updateList.size).toBe(0)

        ret.$ += "."
        expect(updateList.size).toBe(1)
        expect(updateList.has(getEffect())).toBe(true)

        await nextTick()

        // number literal
        ret = reactivity(1)
        expect(ret).toEqual({ $: 1 })
        getEffect().add(updateFunc)

        ret.$ += 0
        expect(updateList.size).toBe(0)

        ret.$ <<= 1
        expect(updateList.size).toBe(1)
        expect(updateList.has(getEffect())).toBe(true)

        ret = constReactivity(1)
        expect(ret).toBe(1)

        await nextTick()

        // Object
        ret = constReactivity({ a: true })
        getEffect().add(updateFunc)
        expect(updateList.size).toBe(0)
        ret.a &&= false
        expect(updateList.size).toBe(1)
        expect(updateList.has(getEffect())).toBe(true)
        await nextTick()
        expect(updateList.size).toBe(0)
        ret.b = ""
        expect(updateList.size).toBe(1)
        await nextTick()
        expect(updateList.size).toBe(0)
        delete ret.a
        expect(updateList.size).toBe(1)

        await nextTick()

        // Array
        ret = reactivity([1, { a: "" }, 2, ""])
        getEffect().add(updateFunc)
        expect(updateList.size).toBe(0)
        ret.$[0] *= 1
        expect(updateList.size).toBe(0)
        ret.$[2] /= 2
        expect(updateList.size).toBe(1)
        await nextTick()
        expect(updateList.size).toBe(0)
        ret.$[1].a += " "
        expect(updateList.size).toBe(1)
        await nextTick()
        expect(updateList.size).toBe(0)
        ret.$.push(4)
        expect(updateList.size).toBe(1)
        await nextTick()
        expect(updateList.size).toBe(0)
        ret.$.pop()
        expect(updateList.size).toBe(1)
        await nextTick()
        expect(updateList.size).toBe(0)
        ret.$.reverse()
        expect(updateList.size).toBe(1)

        await nextTick()

        // Set
        ret = reactivity(new Set([1, 2, 3]))
        getEffect().add(updateFunc)
        expect(updateList.size).toBe(0)
        ret.$.add(3)
        expect(updateList.size).toBe(0)
        ret.$.add(4)
        expect(updateList.size).toBe(1)
        await nextTick()
        ret.$.delete(0)
        expect(updateList.size).toBe(0)
        ret.$.delete(1)
        expect(updateList.size).toBe(1)
        await nextTick()
        expect(updateList.size).toBe(0)
        ret.$.clear()
        expect(updateList.size).toBe(1)

        await nextTick()

        // Map
        ret = constReactivity(
            new Map([
                [1, 2],
                [3, 4]
            ])
        )
        getEffect().add(updateFunc)
        expect(updateList.size).toBe(0)
        ret.set(1, 2)
        expect(updateList.size).toBe(0)
        ret.set([1, 0])
        expect(updateList.size).toBe(1)
        await nextTick()
        expect(updateList.size).toBe(0)
        ret.delete(1)
        expect(updateList.size).toBe(1)
        await nextTick()
        expect(updateList.size).toBe(0)
        ret.clear()
        expect(updateList.size).toBe(1)
        await nextTick()
    })

    test("The reactivity value is different from the origin target", () => {
        let ret1: any, ret2: any
        const secondaryObj = { a: { b: 1 } }

        ret1 = reactivity(secondaryObj)
        expect(ret1.$ !== secondaryObj).toBe(true)
        expect(ret1.$.a !== ret1.$.a).toBe(true)
        expect(ret1.$.a.b === ret1.$.a.b).toBe(true)
        expect(raw(ret1.$) === raw(ret1.$)).toBe(true)
        expect(raw(ret1.$) === secondaryObj).toBe(true)
        expect(raw(ret1.$.a) === raw(ret1.$.a)).toBe(true)
        expect(raw(ret1.$.a) === secondaryObj.a).toBe(true)

        ret2 = constReactivity(ret1.$)
        expect(ret1.$ !== ret2).toBe(true)
        expect(ret1.$.a !== ret2.a).toBe(true)
        expect(ret2 !== secondaryObj).toBe(true)
        expect(ret2.a !== secondaryObj).toBe(true)
        expect(raw(ret1.$) === raw(ret2)).toBe(true)
        expect(raw(ret2) === secondaryObj).toBe(true)
        expect(raw(ret1.$.a) === raw(ret2.a)).toBe(true)
        expect(raw(ret2.a) === secondaryObj.a).toBe(true)
    })

    test("Derived reactive state related function", async () => {
        let count = 0
        const obj1: any = reactivity({ a: 1 })
        const obj2: any = reactivity({ b: 2 })
        const updateFunc: UpdateFunc = () => {
            count++
            return false
        }
        updateFunc.instance = new QingKuaiComponent()

        const der: any = derived(() => obj1.$.a + obj2.$.b)
        expect(der.$).toBe(3)
        obj1.$.a++
        expect(der.$).toBe(4)
        expect(updateList.size).toBe(0)

        obj1[Wrapper].effect[0].add(updateFunc)
        obj2[Wrapper].effect[0].add(updateFunc)
        obj1.$.a /= 2
        expect(der.$).toBe(3)
        expect(updateList.size).toBe(1)
        obj2.$.b /= 2
        expect(der.$).toBe(2)
        expect(updateList.size).toBe(2)
        await nextTick()
        expect(count).toBe(1)

        der.$++
        expect(warnSpy).toBeCalledWith(
            "An assignment to derived reacativity state is invalid, this operation has been ignored."
        )
    })

    test("Watcher(sync) related function(includes derived reactive state)", () => {
        let count = 0
        let pre: any, cur: any
        let obj1 = reactivity({ a: 1, b: 2 })
        let obj2 = reactivity({ b: 2 })
        const verifyInfos = (exp: FixedArray<number, 3>) => {
            expect([count, pre, cur]).toEqual(exp)
        }
        const watchFn = (p: any, c: any) => {
            count++
            pre = p
            cur = c
        }
        const unwatch = watch(obj1, "$", "sync", watchFn)
        expect(count).toBe(0)
        obj1.$ = { a: 10 }
        obj1.$ = { a: 20 }
        expect(count).toBe(2)
        expect(pre).toEqual({ a: 10 })
        expect(cur).toEqual({ a: 20 })
        unwatch()
        obj1.$ = { a: 100 }
        expect(count).toBe(2)
        count = 0

        const unwatch2 = watch(obj1.$, "a", "sync", watchFn)
        expect(count).toBe(0)
        obj1.$ = { a: 10 }
        expect(count).toBe(0)
        obj1.$.a++
        obj1.$.b = 0
        verifyInfos([1, 10, 11])
        count = 0
        unwatch2()
        obj1.$.a++
        expect(count).toBe(0)
        count = 0

        const der = derived(() => obj1.$.a + obj2.$.b)
        expect(der.$).toBe(14)
        obj1.$.a++
        expect(der.$).toBe(15)
        obj2.$.b++
        expect(der.$).toBe(16)

        const unwatch3 = watch(der, "$", "sync", watchFn)
        obj1.$.a++
        verifyInfos([1, 16, 17])
        obj2.$.b += 2
        verifyInfos([2, 17, 19])
        count = 0
        unwatch3()
        obj1.$.a = 0
        verifyInfos([0, 17, 19])
    })

    test("Pre Watcher related function(includes derived reactive state)", async () => {
        let count = 0
        let type = "pre"
        let pre: any, cur: any
        let watcherCalled = false
        let a: any = reactivity(10)
        let b: any = reactivity({ v: 2 })

        const updateFunc: UpdateFunc = () => {
            // 验证watch监听函数是否在DOM更新前被调用
            // verify whether watch func was called brefore updating DOM
            expect(watcherCalled).toBe(true)
            return false
        }
        updateFunc.instance = new QingKuaiComponent()

        // 为响应性值模拟添加一个更新函数
        // mock to add a update func on reactivity value
        a[Wrapper].effect[0].add(updateFunc)
        b[Wrapper].effect[0].add(updateFunc)

        // 验证count、pre、cur以及type
        // verify count, pre, cur and type
        const verifyInfos = (infos: FixedArray<number, 3>) => {
            expect([count, pre, cur, type]).toEqual([...infos, "pre"])
        }

        const watchFn: WatchFunc = (p: any, c: any) => {
            pre = p
            cur = c
            count++
            type = watchFn.type!
            watcherCalled = true
        }

        const resetState = () => {
            count = 0
            pre = watchFn.pre
            cur = watchFn.cur
        }

        // new round
        const unwatch = watch(a, "$", "pre", watchFn)
        resetState()

        a.$++
        verifyInfos([0, 10, 10])
        await nextTick()
        verifyInfos([1, 10, 11])
        watcherCalled = false

        a.$ *= 2
        verifyInfos([1, 10, 11])
        a.$ += 2
        await nextTick()
        verifyInfos([2, 11, 24])

        resetState()
        unwatch()

        a.$ = 0
        await nextTick()
        verifyInfos([0, 24, 24])

        // new round
        const unwatch2 = watch(b.$, "v", "pre", watchFn)
        resetState()

        b.$ = { v: 0 }
        await nextTick()
        verifyInfos([0, 2, 2])
        watcherCalled = false

        b.$.v++
        b.$.v += 2
        verifyInfos([0, 2, 2])
        await nextTick()
        verifyInfos([1, 2, 3])
        unwatch2()

        b.$.v *= 2
        verifyInfos([1, 2, 3])

        b.$.v = 0
        resetState()
        verifyInfos([0, 3, 3])

        // new round
        const c = derived(() => a.$ + b.$.v + 1)
        expect(c.$).toBe(1)
        a.$++
        expect(c.$).toBe(2)
        b.$.v++
        expect(c.$).toBe(3)

        const unwatch3 = watch(c, "$", "pre", watchFn)
        resetState()
        verifyInfos([0, 3, 3])
        watcherCalled = false

        a.$++
        verifyInfos([0, 3, 3])
        await nextTick()
        verifyInfos([1, 3, 4])
        watcherCalled = false

        a.$ += 10
        b.$.v += 10
        verifyInfos([1, 3, 4])
        await nextTick()
        verifyInfos([2, 4, 24])

        unwatch3()
        a.$ += 1
        b.$.v += 1
        verifyInfos([2, 4, 24])
        await nextTick()
        verifyInfos([2, 4, 24])
    })

    test("Post Watcher related function(includes derived reactive state)", async () => {
        // 逻辑部分与pre watcher测试类似，主要验证执行时机
        // The logic part is similar to preWatch test, which mainly verifies the timing of execution
        let count = 0
        let type = "post"
        let pre: any, cur: any
        let watcherCalled = false
        let a: any = reactivity(10)
        let b: any = reactivity({ v: 2 })

        const updateFunc: UpdateFunc = () => {
            // 验证watch监听函数是否在DOM更新后被调用
            // verify whether watch func was called after DOM updated
            expect(watcherCalled).toBe(false)
            return false
        }
        updateFunc.instance = new QingKuaiComponent()

        // 为响应性值模拟添加一个更新函数
        // mock to add a update func on reactivity value
        a[Wrapper].effect[0].add(updateFunc)
        b[Wrapper].effect[0].add(updateFunc)

        // 验证count、pre、cur以及type
        // verify count, pre, cur and type
        const verifyInfos = (infos: FixedArray<number, 3>) => {
            expect([count, pre, cur, type]).toEqual([...infos, "post"])
        }

        const watchFn: WatchFunc = (p: any, c: any) => {
            pre = p
            cur = c
            count++
            type = watchFn.type!
            watcherCalled = true
        }

        const resetState = () => {
            count = 0
            pre = watchFn.pre
            cur = watchFn.cur
        }

        // new round
        const unwatch = watch(a, "$", "post", watchFn)
        resetState()

        a.$++
        verifyInfos([0, 10, 10])
        await nextTick()
        verifyInfos([1, 10, 11])
        watcherCalled = false

        a.$ *= 2
        verifyInfos([1, 10, 11])
        a.$ += 2
        await nextTick()
        verifyInfos([2, 11, 24])
        watcherCalled = false

        resetState()
        unwatch()

        a.$ = 0
        await nextTick()
        verifyInfos([0, 24, 24])

        // new round
        const unwatch2 = watch(b.$, "v", "post", watchFn)
        resetState()

        b.$ = { v: 0 }
        await nextTick()
        verifyInfos([0, 2, 2])

        b.$.v++
        b.$.v += 2
        verifyInfos([0, 2, 2])
        await nextTick()
        verifyInfos([1, 2, 3])
        unwatch2()
        watcherCalled = false

        b.$.v *= 2
        verifyInfos([1, 2, 3])

        b.$.v = 0
        resetState()
        verifyInfos([0, 3, 3])

        // new round
        const c = derived(() => a.$ + b.$.v + 1)
        expect(c.$).toBe(1)
        a.$++
        expect(c.$).toBe(2)
        b.$.v++
        expect(c.$).toBe(3)

        const unwatch3 = watch(c, "$", "post", watchFn)
        resetState()
        verifyInfos([0, 3, 3])

        a.$++
        verifyInfos([0, 3, 3])
        await nextTick()
        verifyInfos([1, 3, 4])
        watcherCalled = false

        a.$ += 10
        b.$.v += 10
        verifyInfos([1, 3, 4])
        await nextTick()
        verifyInfos([2, 4, 24])
        watcherCalled = false

        unwatch3()
        a.$ += 1
        b.$.v += 1
        verifyInfos([2, 4, 24])
        await nextTick()
        verifyInfos([2, 4, 24])
    })

    test("Pre Effect related function(includes derived reactive state)", async () => {
        let count = 0
        let effectCalled = false
        let a: any = reactivity(10)
        const b: any = constReactivity({ v: 2 })

        const updateFunc: UpdateFunc = () => {
            // 验证effect监听函数是否在DOM更新前被调用
            // verify whether effect func was called before updating DOM
            expect(effectCalled).toBe(true)
            return false
        }
        updateFunc.instance = new QingKuaiComponent()

        // 为响应性值模拟添加一个更新函数
        // mock to add a update func on reactivity value
        a[Wrapper].effect[0].add(updateFunc)
        b[Wrapper].effect[0].add(updateFunc)

        const effectFn: EffectFunc = () => {
            a.$ + b.v
            count++
            effectCalled = true
        }

        // new round
        const uneffect = effect("pre", effectFn)
        expect(effectCalled).toBe(true)
        expect(count).toBe(1)
        effectCalled = false

        a.$++
        b.v++
        expect(count).toBe(1)
        await nextTick()
        expect(count).toBe(2)

        uneffect()
        a.$++
        expect(count).toBe(2)
        await nextTick()
        expect(count).toBe(2)
    })

    test("Post Effect related function(includes derived reactive state)", async () => {
        let count = 0
        let effectCalled = false
        let a: any = reactivity(10)
        const b: any = constReactivity({ v: 2 })

        const updateFunc: UpdateFunc = () => {
            // 验证effect监听函数是否在DOM更新后被调用
            // verify whether effect func was called after DOM updated
            expect(effectCalled).toBe(false)
            return false
        }
        updateFunc.instance = new QingKuaiComponent()

        // 为响应性值模拟添加一个更新函数
        // mock to add a update func on reactivity value
        a[Wrapper].effect[0].add(updateFunc)
        b[Wrapper].effect[0].add(updateFunc)

        const effectFn: EffectFunc = () => {
            a.$ + b.v
            count++
            effectCalled = true
        }

        // new round
        const uneffect = effect("post", effectFn)
        expect(effectCalled).toBe(true)
        expect(count).toBe(1)
        effectCalled = false

        a.$++
        b.v++
        expect(count).toBe(1)
        await nextTick()
        expect(count).toBe(2)
        effectCalled = false

        uneffect()
        a.$++
        expect(count).toBe(2)
        await nextTick()
        expect(count).toBe(2)
    })

    test("Whether usedEffectList was set when access reactivity value", () => {
        const v1 = reactivity(1)
        const v2 = reactivity(null)
        const invalid = (...values: any[]) => {
            values.forEach(v => v.$)
            return usedEffectList.size
        }
        clearUsedEffectList()
        expect(invalid(v1)).toEqual(1)
        expect(invalid(v2)).toEqual(2)
        clearUsedEffectList()
        expect(usedEffectList.size).toBe(0)
        expect(invalid(v1, v2)).toEqual(2)
    })

    test("Whether effectsList was recorded when the reactivity value changed", async () => {
        const v1 = reactivity(1)
        const v2 = reactivity({ a: 1 })
        const updateFunc: UpdateFunc = () => false
        updateFunc.instance = new QingKuaiComponent()

        v1.$++
        expect(updateList.size).toBe(0)

        v1[Wrapper].effect[0].add(updateFunc)
        v2[Wrapper].effect[0].add(updateFunc)

        v1.$++
        expect(updateList.size).toBe(1)

        await nextTick()
        expect(updateList.size).toBe(0)
        v1.$++
        v2.$.a++
        expect(updateList.size).toBe(2)
    })
})
