import { toRaw } from "../../../src/util/runtime/sundry"
import { beforeEach, expect, test, vi } from "vitest"
import { emptyArr } from "../../../src/util/shared/arrays"
import { syncEffect } from "../../../src/runtime/reactivity/effect"
import { constReact, react } from "../../../src/runtime/reactivity/value"

const arr: any[] = []
const invokeMarker = vi.fn()

const cleanup = () => {
    emptyArr(arr)
    invokeMarker.mockClear()
}

beforeEach(cleanup)

test("Functions of deleteProperty handler", () => {
    const nums = constReact([1, 2])
    const obj = constReact({ a: 3, b: 4 })
    syncEffect(() => {
        invokeMarker()
        arr.push(nums[0], nums[1], obj.a, obj.b)
    })
    expect(arr).toEqual([1, 2, 3, 4])
    expect(invokeMarker).toHaveBeenCalledTimes(1)

    delete nums[0]
    expect(invokeMarker).toHaveBeenCalledTimes(2)
    expect(arr.slice(4)).toEqual([undefined, 2, 3, 4])

    delete obj.a
    expect(invokeMarker).toHaveBeenCalledTimes(3)
    expect(arr.slice(8)).toEqual([undefined, 2, undefined, 4])

    delete obj.b
    delete nums[1]
    expect(arr.slice(12)).toEqual([
        undefined,
        2,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
    ])
    expect(invokeMarker).toHaveBeenCalledTimes(5)

    delete obj.a
    expect(arr.length).toBe(20)
    expect(invokeMarker).toHaveBeenCalledTimes(5)

    const strs = (cleanup(), constReact(["qing", "kuai"]))
    syncEffect(() => {
        arr.push(strs[0])
    })
    expect(arr).toEqual(["qing"])

    delete strs[0]
    expect(arr).toEqual(["qing", undefined])

    strs.shift()
    expect(arr).toEqual(["qing", undefined, "kuai"])

    strs.unshift(undefined)
    expect(arr).toEqual(["qing", undefined, "kuai", undefined])

    delete strs[0]
    expect(arr).toEqual(["qing", undefined, "kuai", undefined])
})

test("Functions of ownKeys handler", () => {
    const nums = constReact([1, 2])
    const obj = constReact({ a: 3, b: 4 })
    const set = constReact(new Set(toRaw(nums)))
    set.custom = ""
    syncEffect(() => {
        emptyArr(arr)
        arr.push(...Reflect.ownKeys(set))
    })
    expect(arr).toEqual(["custom"])

    delete set.custom
    expect(arr).toEqual([])

    syncEffect(() => {
        emptyArr(arr)
        invokeMarker()
        arr.push(...Reflect.ownKeys(nums))
    })
    expect(arr).toEqual(["0", "1", "length"])
    expect(invokeMarker).toHaveBeenCalledTimes(1)

    nums.pop()
    expect(arr).toEqual(["0", "length"])
    expect(invokeMarker).toHaveBeenCalledTimes(2)

    Object.setPrototypeOf(nums, { "1": 99 })
    expect("1" in nums).toBeTruthy()
    expect(arr).toEqual(["0", "length"])
    expect(invokeMarker).toHaveBeenCalledTimes(3)

    syncEffect(() => {
        emptyArr(arr)
        invokeMarker()
        arr.push(...Reflect.ownKeys(obj))
    })
    expect(arr).toEqual(["a", "b"])
    expect(invokeMarker).toHaveBeenCalledTimes(4)

    delete obj.a
    expect(arr).toEqual(["b"])
    expect(invokeMarker).toHaveBeenCalledTimes(5)

    obj.b++
    expect(arr).toEqual(["b"])
    expect(invokeMarker).toHaveBeenCalledTimes(5)

    Object.assign(obj, { b: 99 })
    expect(arr).toEqual(["b"])
    expect(invokeMarker).toHaveBeenCalledTimes(5)

    obj.a = 0
    expect(arr).toEqual(["b", "a"])
    expect(invokeMarker).toHaveBeenCalledTimes(6)
})

test("Functions of has handler", () => {
    const nums = react([1, 2, 3])
    syncEffect(() => {
        arr.push(+("2" in nums.$))
    })
    expect(arr).toEqual([1])

    nums.$[2]++
    expect(arr).toEqual([1])

    nums.$.pop()
    expect(arr).toEqual([1, 0])

    nums.$.push(3, 4)
    expect(arr).toEqual([1, 0, 1])

    nums.$.shift()
    expect(arr).toEqual([1, 0, 1])

    nums.$.shift()
    expect(arr).toEqual([1, 0, 1, 0])

    Object.setPrototypeOf(nums.$, { "2": 99 })
    expect(arr).toEqual([1, 0, 1, 0, 1])

    Object.setPrototypeOf(nums.$, null)
    expect(arr).toEqual([1, 0, 1, 0, 1, 0])

    Object.setPrototypeOf(nums.$, {})
    expect(arr).toEqual([1, 0, 1, 0, 1, 0])

    Object.getPrototypeOf(nums.$)["2"] = ""
    expect(arr).toEqual([1, 0, 1, 0, 1, 0, 1])

    Object.setPrototypeOf(nums.$, {})
    expect(arr).toEqual([1, 0, 1, 0, 1, 0, 1, 0])

    Object.setPrototypeOf(Object.getPrototypeOf(nums.$), {})
    expect(arr).toEqual([1, 0, 1, 0, 1, 0, 1, 0])

    Object.getPrototypeOf(Object.getPrototypeOf(nums.$))["2"] = ""
    expect(arr).toEqual([1, 0, 1, 0, 1, 0, 1, 0, 1])

    nums.$.__proto__ = null
    expect(arr).toEqual([1, 0, 1, 0, 1, 0, 1, 0, 1, 0])

    const obj = {}
    Object.setPrototypeOf(obj, [9, 99, 999])
    nums.$.__proto__ = obj
    expect(nums.$[1]).toBe(4)
    expect(nums.$[2]).toBe(999)
    expect(arr).toEqual([1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1])

    nums.$.pop()
    expect(nums.$[1]).toBe(99)
})

test("Functions of getProtoType handler", () => {
    const obj = constReact({})
    syncEffect(() => {
        arr.push(Object.getPrototypeOf(obj))
    })
    expect(arr).toEqual([{}])

    obj.a = 1
    expect(arr).toEqual([{}])

    delete obj.a
    expect(arr).toEqual([{}])

    Object.setPrototypeOf(obj, null)
    expect(arr).toEqual([{}, null])

    Object.setPrototypeOf(obj, { foo: "bar" })
    expect(arr).toEqual([{}, null, { foo: "bar" }])
})
