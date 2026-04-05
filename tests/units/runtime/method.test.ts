import { any, optc } from "../../../src/util/shared/sundry"
import { isReactive } from "../../../src/util/runtime/assert"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { batchUpdating, effect, syncEffect } from "../../../src/runtime"
import { ITERATOR_KEYS, WRAPPER } from "../../../src/runtime/reactivity/constants"
import { constReact, react, shallowConstReact } from "../../../src/runtime/internal"
import { isArray, isBoolean, isNumber, isObject, isString } from "../../../src/util/shared/assert"
import { arrayFrom, emptyArr, getLastElem, replaceEachItems } from "../../../src/util/shared/arrays"

const arr: any[] = []
const invokeMarker = vi.fn()

const cleanup = () => {
    emptyArr(arr)
    invokeMarker.mockClear()
}

beforeEach(cleanup)

describe("Array prototype methods", () => {
    test("pop", () => {
        const nums = react([1, 2, 3])
        syncEffect(() => {
            arr.push(nums.$[2])
        })
        expect(arr).toEqual([3])

        nums.$.pop()
        expect(arr).toEqual([3, undefined])

        syncEffect(() => {
            arr.push("2" in nums.$)
        })
        expect(arr).toEqual([3, undefined, false])

        nums.$.push(undefined)
        expect(arr).toEqual([3, undefined, false, true])

        nums.$.pop()
        expect(arr).toEqual([3, undefined, false, true, false])

        syncEffect(() => {
            emptyArr(arr)
            for (const item of nums.$) {
                arr.push(item)
            }
        })
        expect(arr).toEqual([1, 2])

        nums.$.pop()
        expect(arr).toEqual([1])
    })

    test("flat", () => {
        const mdNums = constReact([1, [2, [3]]])
        expect(mdNums.flat(-1)).toEqual(mdNums)
        expect(mdNums.flat(0)).toEqual(mdNums)
        expect(mdNums.flat()).toEqual([1, 2, [3]])
        expect(mdNums.flat(2)).toEqual([1, 2, 3])

        syncEffect(() => {
            replaceEachItems(arr, mdNums.flat(Infinity))
        })
        expect(arr).toEqual([1, 2, 3])

        mdNums[1].push(4)
        expect(arr).toEqual([1, 2, 3, 4])

        mdNums[1][1].push(5)
        expect(arr).toEqual([1, 2, 3, 5, 4])

        mdNums[1][1].shift()
        expect(arr).toEqual([1, 2, 5, 4])

        mdNums[1][0]++
        expect(arr).toEqual([1, 3, 5, 4])

        delete mdNums[1][0]
        expect(arr).toEqual([1, 5, 4])

        mdNums[1].unshift(undefined)
        expect(arr).toEqual([1, undefined, 5, 4])
    })

    test("concat", () => {
        const nums = react([1, 2])
        const strs = constReact(["qing", "kuai"])
        expect(nums.$.concat(strs)).toEqual([1, 2, "qing", "kuai"])

        syncEffect(() => {
            invokeMarker()
            replaceEachItems(arr, strs.concat(nums.$))
        })
        expect(arr).toEqual(["qing", "kuai", 1, 2])

        nums.$.pop()
        expect(arr).toEqual(["qing", "kuai", 1])

        strs.pop()
        expect(arr).toEqual(["qing", 1])

        strs[0] = "a"
        expect(arr).toEqual(["a", 1])

        ++nums.$[0]
        expect(arr).toEqual(["a", 2])

        nums.$.unshift(1)
        expect(arr).toEqual(["a", 1, 2])

        nums.$[Symbol.isConcatSpreadable] = false
        expect(isArray(arr[1])).toBeTruthy()
        expect(invokeMarker).toHaveBeenCalledTimes(7)

        nums.$.push(3)
        expect(invokeMarker).toHaveBeenCalledTimes(7)

        // ArrayLike
        nums.$ = { length: 2 }
        expect(arr).toEqual(["a", { length: 2 }])
        expect(invokeMarker).toHaveBeenCalledTimes(8)

        nums.$[Symbol.isConcatSpreadable] = true
        expect(invokeMarker).toHaveBeenCalledTimes(9)
        expect(arr).toEqual(["a", undefined, undefined])

        // mutipile assignments
        ;[nums.$[0], nums.$[1]] = [9, 99]
        expect(arr).toEqual(["a", 9, 99])
        expect(invokeMarker).toHaveBeenCalledTimes(11)

        batchUpdating(() => {
            ++nums.$[0]
            nums.$[1]++
        })
        expect(arr).toEqual(["a", 10, 100])
        expect(invokeMarker).toHaveBeenCalledTimes(12)
    })

    test("sort", () => {
        const nums = constReact([3, 2, 1])
        const compareFn = (a: any, b: any) => {
            if (isObject(a)) {
                expect(isReactive(a)).toBeTruthy()
                a = a.v
            }
            if (isObject(b)) {
                expect(isReactive(b)).toBeTruthy()
                b = b.v
            }
            return a - b
        }
        expect(nums.sort(compareFn)).toBe(nums)
        expect(nums).toEqual([1, 2, 3])

        syncEffect(() => {
            const ret = nums.sort(compareFn)
            emptyArr(arr)
            for (const item of ret) {
                arr.push(item)
            }
            expect(ret).toBe(nums)
        })
        expect(arr).toEqual([1, 2, 3])

        nums.unshift(9)
        expect(arr).toEqual([1, 2, 3, 9])

        nums.push({ v: 5 })
        expect(arr).toEqual([1, 2, 3, { v: 5 }, 9])

        nums[3].v = 0
        expect(arr).toEqual([{ v: 0 }, 1, 2, 3, 9])
    })

    test("toSorted", () => {
        const nums = shallowConstReact([1, 2, 3])
        const compareFn = (a: any, b: any) => {
            if (isArray(a)) {
                expect(isReactive(a)).toBeFalsy()
                a = a[0]
            }
            if (isArray(b)) {
                expect(isReactive(b)).toBeFalsy()
                b = b[0]
            }
            return b - a
        }
        expect(nums.toSorted(compareFn)).toEqual([3, 2, 1])
        expect(nums).toEqual([1, 2, 3])

        syncEffect(() => {
            const ret = nums.toSorted(compareFn)
            expect(isReactive(ret)).toBeFalsy()
            replaceEachItems(arr, ret)
        })
        expect(arr).toEqual([3, 2, 1])

        nums.push(9)
        expect(arr).toEqual([9, 3, 2, 1])

        nums.unshift([0])
        expect(arr).toEqual([9, 3, 2, 1, [0]])

        nums[0][0] += 4
        expect(arr).toEqual([9, 3, 2, 1, [4]])
    })

    test("flatMap", () => {
        const nums = constReact([1, 2, 3])
        expect(nums.flatMap((item: any) => [item])).toEqual([1, 2, 3])

        syncEffect(() => {
            invokeMarker()
            replaceEachItems(
                arr,
                nums.flatMap(function (this: any, item: any, index: any, caller: any) {
                    expect(this).toBe(1)
                    expect(caller).toBe(nums)
                    expect(isNumber(index)).toBeTruthy()
                    return isArray(item) ? [item[0] + 1, ...item.slice(1)] : item
                }, 1)
            )
        })
        expect(arr).toEqual([1, 2, 3])

        nums[1] = [2]
        expect(arr).toEqual([1, 3, 3])

        nums[1][0]++
        expect(arr).toEqual([1, 4, 3])

        nums[1].push(9)
        expect(arr).toEqual([1, 4, 9, 3])

        nums[2] = [3, [4]]
        expect(arr).toEqual([1, 4, 9, 4, [4]])
        expect(invokeMarker).toHaveBeenCalledTimes(5)

        nums[2][1][0] += 10
        expect(arr).toEqual([1, 4, 9, 4, [14]])
        expect(invokeMarker).toHaveBeenCalledTimes(5)
    })

    test("indexOf, lastIndexOf", () => {
        for (const funcName of ["indexOf", "lastIndexOf"] as const) {
            const nums = constReact([1, 2, 3])
            const snums = shallowConstReact([1, 2, 3])
            expect(nums[funcName](3)).toBe(2)
            expect(nums[funcName](0)).toBe(-1)

            const sub: any = []
            nums.push(sub)
            snums.push(sub)
            expect(nums[funcName](sub)).toBe(3)
            expect(snums[funcName](sub)).toBe(3)
            expect(nums[funcName](constReact(sub))).toBe(3)
            expect(snums[funcName](constReact(sub))).toBe(-1)

            nums[3] = constReact(sub)
            snums[3] = constReact(sub)
            expect(nums[funcName](sub)).toBe(3)
            expect(snums[funcName](sub)).toBe(-1)
            expect(nums[funcName](constReact(sub))).toBe(3)
            expect(snums[funcName](constReact(sub))).toBe(3)
        }
    })

    test("indexOf", () => {
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            arr.push(nums.indexOf(3))
        })
        expect(arr).toEqual([2])

        nums[2]++
        expect(arr).toEqual([2, -1])

        nums.pop()
        expect(arr).toEqual([2, -1, -1])

        nums.push(undefined, 3, null)
        expect(arr).toEqual([2, -1, -1, 3])

        nums[0]++
        ++nums[1]
        expect(arr).toEqual([2, -1, -1, 3, 3, 1])
    })

    test("lastIndexOf", () => {
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            arr.push(nums.lastIndexOf(3))
        })
        expect(arr).toEqual([2])

        nums[1]++
        expect(arr).toEqual([2, 2])

        nums.push(3, 4)
        expect(arr).toEqual([2, 2, 3])

        nums.fill(0)
        expect(arr).toEqual([2, 2, 3, -1])

        nums.unshift(3)
        expect(arr).toEqual([2, 2, 3, -1, 0])
    })

    test("find, findLast", () => {
        for (const funcName of ["find", "findLast"] as const) {
            const nums = constReact([1, 2, 3])
            const snums = shallowConstReact([1, 2, 3])
            expect(() => {
                nums.find(3)
            }).toThrow(/callback is not a function/)
            expect(nums[funcName]((item: any) => item == 3)).toEqual(3)
            expect(snums[funcName]((item: any) => item == 3)).toEqual(3)

            const sub: any = []
            const rsub = constReact(sub)
            const findWithRaw = (item: any) => item === sub
            const findWithReactive = (item: any) => item === rsub

            nums.push(sub)
            snums.push(sub)
            expect(nums[funcName](findWithRaw)).toBeUndefined()
            expect(snums[funcName](findWithRaw)).toBe(sub)
            expect(nums[funcName](findWithReactive)).toBe(rsub)
            expect(snums[funcName](findWithReactive)).toBeUndefined()

            nums[3] = rsub
            snums[3] = rsub
            expect(nums[funcName](findWithRaw)).toBeUndefined()
            expect(snums[funcName](findWithRaw)).toBeUndefined()
            expect(nums[funcName](findWithReactive)).toBe(rsub)
            expect(snums[funcName](findWithReactive)).toBe(rsub)
        }
    })

    test("find", () => {
        const strs = constReact(["qing", "kuai"])
        syncEffect(() => {
            arr.push(
                strs.find(function (this: any, item: any, index: any, caller: any) {
                    expect(this).toBeUndefined()
                    expect(caller).toBe(strs)
                    expect(isNumber(index)).toBeTruthy()
                    if (isObject(item)) {
                        expect(isReactive(item)).toBeTruthy()
                        return item.v === "kuai"
                    }
                    return item === "kuai"
                })
            )
        })
        expect(arr).toEqual(["kuai"])

        strs.pop()
        expect(arr).toEqual(["kuai", undefined])

        strs.unshift({ v: "kuai" })
        expect(arr).toEqual(["kuai", undefined, { v: "kuai" }])
    })

    test("findLast", () => {
        const strs = shallowConstReact(["foo", "bar"])
        syncEffect(() => {
            arr.push(
                strs.find(function (this: any, item: any, index: any, caller: any) {
                    expect(this).toBe(test)
                    expect(caller).toBe(strs)
                    expect(isNumber(index)).toBeTruthy()
                    if (isArray(item)) {
                        expect(isReactive(item)).toBeFalsy()
                        return item[0] === "foo"
                    }
                    return item === "foo"
                }, test)
            )
            invokeMarker()
        })
        expect(arr).toEqual(["foo"])
        expect(invokeMarker).toHaveBeenCalledTimes(1)

        strs.shift()
        expect(arr).toEqual(["foo", undefined])
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        strs.push(["foo"])
        expect(arr).toEqual(["foo", undefined, ["foo"]])
        expect(invokeMarker).toHaveBeenCalledTimes(3)

        strs[1][0] = "bar"
        expect(invokeMarker).toHaveBeenCalledTimes(3)
    })

    test("findIndex, findLastIndex", () => {
        for (const funcName of ["findIndex", "findLastIndex"] as const) {
            const nums = constReact([1, 2, 3])
            const snums = shallowConstReact([1, 2, 3])
            expect(() => {
                nums.find(3)
            }).toThrow(/callback is not a function/)
            expect(nums[funcName]((item: any) => item == 3)).toEqual(2)
            expect(snums[funcName]((item: any) => item == 3)).toEqual(2)

            const sub: any = []
            const rsub = constReact(sub)
            const findWithRaw = (item: any) => item === sub
            const findWithReactive = (item: any) => item === rsub

            nums.push(sub)
            snums.push(sub)
            expect(nums[funcName](findWithRaw)).toBe(-1)
            expect(snums[funcName](findWithRaw)).toBe(3)
            expect(nums[funcName](findWithReactive)).toBe(3)
            expect(snums[funcName](findWithReactive)).toBe(-1)

            nums[3] = rsub
            snums[3] = rsub
            expect(nums[funcName](findWithRaw)).toBe(-1)
            expect(snums[funcName](findWithRaw)).toBe(-1)
            expect(nums[funcName](findWithReactive)).toBe(3)
            expect(snums[funcName](findWithReactive)).toBe(3)
        }
    })

    test("findIndex", () => {
        const nums = react([1, 2, 3])
        syncEffect(() => {
            arr.push(
                nums.$.findIndex(function (this: any, item: any, index: any, caller: any) {
                    expect(this).toBe(nums.$)
                    expect(caller).toBe(nums.$)
                    expect(isNumber(index)).toBeTruthy()
                    if (isObject(item)) {
                        expect(isReactive(item)).toBeTruthy()
                        return item.v === 2
                    }
                    return item === 2
                }, nums.$)
            )
        })
        expect(arr).toEqual([1])

        nums.$[1]++
        expect(arr).toEqual([1, -1])

        --nums.$[2]
        expect(arr).toEqual([1, -1, 2])

        nums.$.unshift({ v: 2 })
        expect(arr).toEqual([1, -1, 2, 0])

        ++nums.$[0].v
        expect(arr).toEqual([1, -1, 2, 0, 3])
    })

    test("findLastIndex", () => {
        const nums = shallowConstReact([1, 2, 3])
        syncEffect(() => {
            arr.push(
                nums.findLastIndex(function (this: null, item: any, index: any, caller: any) {
                    expect(this).toBeNull()
                    expect(caller).toBe(nums)
                    expect(isNumber(index)).toBeTruthy()
                    if (isObject(item)) {
                        expect(isReactive(item)).toBeFalsy()
                        return item.v === 1
                    }
                    return item === 1
                }, null)
            )
        })
        expect(arr).toEqual([0])

        nums.push(1)
        expect(arr).toEqual([0, 3])

        nums.push({ v: 1 })
        expect(arr).toEqual([0, 3, 4])

        any(getLastElem(nums)).v++
        expect(arr).toEqual([0, 3, 4])
    })

    test("reduce", () => {
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            const ret = nums.reduce((pre: any, cur: any, index: any, caller: any) => {
                expect(caller).toBe(nums)
                expect(isReactive(pre)).toBeFalsy()
                expect(isNumber(index)).toBeTruthy()
                if (isObject(cur)) {
                    expect(isReactive(cur)).toBeTruthy()
                    return [...pre, cur.v + 1]
                }
                return [...pre, cur + 1]
            }, [])
            replaceEachItems(arr, ret)
            expect(isReactive(ret)).toBeFalsy()
        })
        expect(arr).toEqual([2, 3, 4])

        nums[0]++
        expect(arr).toEqual([3, 3, 4])

        nums.push({ v: 9 })
        expect(arr).toEqual([3, 3, 4, 10])

        any(getLastElem(nums)).v++
        expect(arr).toEqual([3, 3, 4, 11])
    })

    test("reduceRight", () => {
        const strs = shallowConstReact(["foo"])
        syncEffect(() => {
            const ret = strs.reduceRight((pre: any, cur: any, index: any, caller: any) => {
                expect(caller).toBe(strs)
                expect(isReactive(pre)).toBeFalsy()
                expect(isNumber(index)).toBeTruthy()
                if (isObject(cur)) {
                    expect(isReactive(cur)).toBeFalsy()
                    return pre + cur.v
                }
                return pre + cur
            }, "Ret: ")
            emptyArr(arr), arr.push(ret)
            expect(isString(ret)).toBeTruthy()
        })
        expect(arr[0]).toBe("Ret: foo")

        strs.unshift("bar")
        expect(arr[0]).toBe("Ret: foobar")

        strs[0] = { v: "..." }
        expect(arr[0]).toBe("Ret: foo...")

        strs[0].v = "___"
        expect(arr[0]).toBe("Ret: foo...")

        strs.reverse()
        expect(arr[0]).toBe("Ret: ___foo")

        strs.length = 1
        expect(arr[0]).toBe("Ret: foo")
    })

    test("toString", () => {
        const nums = react([1, 2, 3])
        syncEffect(() => {
            emptyArr(arr)
            invokeMarker()
            arr.push(nums.$.toString())
        })
        expect(arr[0]).toBe("1,2,3")

        delete nums.$[2]
        expect(arr[0]).toBe("1,2,")
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        nums.$[2] = undefined
        expect(arr[0]).toBe("1,2,")
        expect(invokeMarker).toHaveBeenCalledTimes(3)

        nums.$.pop()
        expect(arr[0]).toBe("1,2")
        expect(invokeMarker).toHaveBeenCalledTimes(4)
    })

    test("toReversed", () => {
        const nums = react([1, 2, 3])
        syncEffect(() => {
            replaceEachItems(arr, nums.$.toReversed())
        })
        expect(arr).toEqual([3, 2, 1])

        nums.$ = [nums.$[0], 4, ...nums.$.slice(1)]
        expect(arr).toEqual([3, 2, 4, 1])

        nums.$.splice(2, 1)
        expect(arr).toEqual([3, 4, 1])

        nums.$.push(9)
        expect(arr).toEqual([9, 3, 4, 1])
    })

    test("join", () => {
        const seperator = react(" and ")
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            invokeMarker()
            emptyArr(arr)
            arr.push(nums.join(seperator.$))
        })
        expect(arr[0]).toBe("1 and 2 and 3")

        nums[2] = undefined
        expect(arr[0]).toBe("1 and 2 and ")

        delete nums[2]
        expect(arr[0]).toBe("1 and 2 and ")
        expect(invokeMarker).toHaveBeenCalledTimes(3)

        nums.pop()
        expect(arr[0]).toBe("1 and 2")
        expect(invokeMarker).toHaveBeenCalledTimes(4)

        seperator.$ = ", "
        expect(arr[0]).toBe("1, 2")
        expect(invokeMarker).toHaveBeenCalledTimes(5)
    })

    test("map", () => {
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            const ret = nums.map(function (this: any, item: any, index: any, caller: any) {
                expect(this).toBe(Number)
                expect(caller).toBe(nums)
                expect(isNumber(index)).toBeTruthy()
                if (isObject(item)) {
                    return item
                }
                return { v: item }
            }, Number)
            replaceEachItems(arr, ret)
            expect(isReactive(ret)).toBeFalsy()
        })
        expect(arr).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }])

        nums.splice(1, 3)
        expect(arr).toEqual([{ v: 1 }])

        nums.push({ v: 999 })
        expect(arr).toEqual([{ v: 1 }, { v: 999 }])
    })

    test("every", () => {
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            const ret = nums.every(function (this: any, item: any, index: any, caller: any) {
                expect(caller).toBe(nums)
                expect(this).toBe(Boolean)
                expect(isNumber(index)).toBeTruthy()
                if (isObject(item)) {
                    return item.v < 10
                }
                return item < 10
            }, Boolean)
            arr.push(ret)
            expect(isBoolean(ret)).toBeTruthy()
        })
        expect(arr).toEqual([true])

        nums.push({ v: 11 })
        expect(arr).toEqual([true, false])

        nums[3].v -= 2
        expect(arr).toEqual([true, false, true])
    })

    test("filter", () => {
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            const ret = nums.filter(function (this: any, item: any, index: any, caller: any) {
                expect(this).toBeNull()
                expect(caller).toBe(nums)
                expect(isNumber(index)).toBeTruthy()
                if (isObject(item)) {
                    expect(isReactive(item)).toBeTruthy()
                    return item.v % 2
                }
                return item % 2
            }, null)
            invokeMarker()
            replaceEachItems(arr, ret)
            expect(isReactive(ret)).toBeFalsy()
        })
        expect(arr).toEqual([1, 3])

        nums.push(4)
        expect(arr).toEqual([1, 3])
        expect(invokeMarker).toHaveBeenCalledTimes(2)

        nums.push({ v: 5 })
        expect(arr).toEqual([1, 3, { v: 5 }])
    })

    test("shift", () => {
        const nums = constReact([1, 2])
        syncEffect(() => {
            arr.push(nums[0], nums.length)
        })
        expect(arr).toEqual([1, 2])

        nums.pop()
        expect(arr).toEqual([1, 2, 1, 1])

        nums.pop()
        expect(arr).toEqual([1, 2, 1, 1, undefined, 0])

        nums.pop()
        expect(arr).toEqual([1, 2, 1, 1, undefined, 0])
    })

    test("reverse", () => {
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            const ret = nums.reverse()
            expect(ret).toBe(nums)
            replaceEachItems(arr, ret)
        })
        expect(arr).toEqual([3, 2, 1])

        nums.shift()
        expect(arr).toEqual([1, 2])

        nums.push(4)
        expect(arr).toEqual([4, 2, 1])

        nums.push(5)
        expect(arr).toEqual([5, 1, 2, 4])
    })

    test("fill", () => {
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            arr.push(nums[0])
        })
        expect(arr).toEqual([1])

        nums.fill(0)
        expect(arr).toEqual([1, 0])

        nums.fill(0)
        expect(arr).toEqual([1, 0])

        nums.fill(999)
        expect(arr).toEqual([1, 0, 999])
        expect(nums).toEqual([999, 999, 999])
    })

    test("push", () => {
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            emptyArr(arr)
            arr.push(nums[3], nums[8])
        })
        syncEffect(() => {
            arr.push(nums.length)
        })
        expect(arr).toEqual([undefined, undefined, 3])

        nums.push(4)
        expect(arr).toEqual([4, undefined, 4])

        nums.push(5, 6, 7, 8, 9)
        expect(arr).toEqual([4, 9, 9])

        syncEffect(() => {
            arr.push("8" in nums)
        })
        expect(arr).toEqual([4, 9, 9, true])

        nums.length = 0
        expect(arr).toEqual([undefined, undefined, 0, false])

        replaceEachItems(nums, [1])
        expect(getLastElem(arr)).toEqual(1)

        syncEffect(() => {
            emptyArr(arr)
            nums.forEach((item: any) => {
                arr.push(item)
            })
        })
        expect(arr).toEqual([1])

        nums.push(2)
        expect(arr).toEqual([1, 2])

        nums.push(3, 4)
        expect(arr).toEqual([1, 2, 3, 4])

        nums.push()
        expect(arr).toEqual([1, 2, 3, 4])
    })

    test("unshift", () => {
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            invokeMarker()
            replaceEachItems(arr, [nums[0], nums.length])
        })
        expect(arr).toEqual([1, 3])

        nums.unshift(4)
        expect(arr).toEqual([4, 4])

        nums.unshift(5, 6, 7)
        expect(arr).toEqual([5, 7])
        expect(invokeMarker).toHaveBeenCalledTimes(3)

        nums.unshift()
        expect(arr).toEqual([5, 7])
        expect(invokeMarker).toHaveBeenCalledTimes(3)
    })

    test("splice", () => {
        const nums = constReact([1, 2, 3])
        syncEffect(() => {
            replaceEachItems(arr, nums)
        })
        expect(arr).toEqual([1, 2, 3])

        nums.splice()
        expect(arr).toEqual([1, 2, 3])

        nums.splice(3, 1)
        expect(arr).toEqual([1, 2, 3])

        for (const invalidValue of [0, "", NaN, false, null, undefined]) {
            nums.splice(invalidValue)
            nums.splice(0, invalidValue)
            nums.splice(invalidValue, invalidValue)
            expect(arr).toEqual([1, 2, 3])
        }

        nums.splice(0, 2)
        expect(arr).toEqual([3])
    })

    test("forEach", () => {
        const nums = constReact([1, 2, {}])
        syncEffect(() => {
            nums.forEach(function (this: any, item: any, index: any, caller: any) {
                expect(this).toBeNaN()
                expect(caller).toBe(nums)
                expect(isNumber(index)).toBeTruthy()
                expect(!isObject(item) || isReactive(item)).toBeTruthy()
            }, NaN)
        })
        expect(nums[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()
    })

    test("keys", () => {
        const nums = constReact([1, 2, 3])
        effect(() => {
            for (const key of nums.keys()) {
                arr.push(key)
                expect(isNumber(key)).toBeTruthy()
            }
        })
        expect(arr).toEqual([0, 1, 2])
        expect(nums[WRAPPER].a.has(ITERATOR_KEYS)).toBeTruthy()
    })

    test("values", () => {
        const nums = constReact([1, 2, { v: 3 }])
        syncEffect(() => {
            for (const value of nums.values()) {
                arr.push(value)
                expect(!isObject(value) || isReactive(value)).toBeTruthy()
            }
        })
        expect(arr).toEqual(nums)
        expect(nums[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()

        const snums = shallowConstReact([1, 2, { v: 3 }])
        syncEffect(() => {
            for (const value of snums.values()) {
                arr.push(value)
                expect(isReactive(value)).toBeFalsy()
            }
        })
        expect(arr).toEqual(nums.concat(snums))
        expect(snums[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()
    })

    test("entries", () => {
        const nums = constReact([1, 2, [3]])
        syncEffect(() => {
            for (const entry of nums.entries()) {
                arr.push(entry)
                expect(isArray(entry)).toBeTruthy()
                expect(!isArray(entry[1]) || isReactive(entry[1])).toBeTruthy()
            }
        })
        expect(arr).toEqual([
            [0, 1],
            [1, 2],
            [2, [3]]
        ])
        expect(nums[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()
    })
})

describe("Set prototype methods", () => {
    test("has", () => {
        const sub = {}
        const rsub = constReact(sub)
        const set = constReact(new Set())
        const sset = shallowConstReact(new Set())

        set.add(sub)
        sset.add(sub)
        expect(set.size).toBe(1)
        expect(sset.size).toBe(1)
        expect(set.has(sub)).toBeTruthy()
        expect(set.has(rsub)).toBeTruthy()
        expect(sset.has(sub)).toBeTruthy()
        expect(sset.has(rsub)).toBeFalsy()

        set.add(rsub)
        sset.add(rsub)
        expect(set.size).toBe(1)
        expect(sset.size).toBe(2)
        expect(set.has(sub)).toBeTruthy()
        expect(set.has(rsub)).toBeTruthy()
        expect(sset.has(sub)).toBeTruthy()
        expect(sset.has(rsub)).toBeTruthy()
    })

    test("add", () => {
        const set = constReact(new Set())
        syncEffect(() => {
            replaceEachItems(arr, [set.has(3), set.size])
        })
        expect(arr).toEqual([false, 0])

        set.add()
        expect(arr).toEqual([false, 1])

        set.add()
        expect(arr).toEqual([false, 1])

        set.add(3)
        expect(arr).toEqual([true, 2])

        let sub1 = {}
        let sub2 = constReact(sub1)
        for (let i = 0; i < 2; i++) {
            if (i) {
                ;[sub1, sub2] = [sub2, sub1]
            }

            const set1 = constReact(new Set())
            const set2 = shallowConstReact(new Set())
            set1.add(sub1)
            set2.add(sub1)
            expect(set1.size).toBe(1)
            expect(set2.size).toBe(1)

            set1.add(sub2)
            set2.add(sub2)
            expect(set1.size).toBe(1)
            expect(set2.size).toBe(2)
        }
    })

    test("delete", () => {
        const set = constReact(new Set([1, 2, 3]))
        syncEffect(() => {
            arr.push(set.size)
        })
        expect(arr).toEqual([3])

        set.delete(3)
        expect(arr).toEqual([3, 2])

        set.delete(3)
        expect(arr).toEqual([3, 2])

        set.delete(0)
        expect(arr).toEqual([3, 2])

        set.delete(1)
        expect(arr).toEqual([3, 2, 1])

        let sub1: any = []
        let sub2 = constReact(sub1)
        for (let i = 0; i < 2; i++) {
            if (i) {
                ;[sub1, sub2] = [sub2, sub1]
            }

            const set1 = constReact(new Set([sub1]))
            const set2 = shallowConstReact(new Set([sub1]))
            set1.delete(sub2)
            set2.delete(sub2)
            expect(set1.size).toBe(0)
            expect(set2.size).toBe(1)

            set2.delete(sub1)
            expect(set2.size).toBe(0)
        }
    })

    test("clear", () => {
        const set = constReact(new Set([1, 2, 3]))
        syncEffect(() => {
            arr.push(set.has(3), set.size)
        })
        expect(arr).toEqual([true, 3])

        set.clear()
        expect(arr).toEqual([true, 3, false, 0])

        set.clear()
        expect(arr).toEqual([true, 3, false, 0])
    })

    test("forEach", () => {
        const set = constReact(new Set([1, 2, [3]]))
        const sset = shallowConstReact(new Set([1, 2, [3]]))
        syncEffect(() => {
            set.forEach(function (this: any, value: any, key: any, caller: any) {
                expect(this).toBeNull()
                expect(key).toBe(value)
                expect(caller).toBe(set)
                expect(!isArray(value) || isReactive(value)).toBeTruthy()
            }, null)
        })
        expect(set[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()

        syncEffect(() => {
            sset.forEach(function (this: any, value: any, key: any, caller: any) {
                expect(this).toBeNull()
                expect(key).toBe(value)
                expect(caller).toBe(sset)
                expect(isArray(value) && isReactive(value)).toBeFalsy()
            }, null)
        })
        expect(sset[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()
    })

    test("keys, values", () => {
        for (const funcName of ["keys", "values"]) {
            const set = constReact(new Set([1, 2, [3]]))
            const sset = shallowConstReact(new Set([1, 2, [3]]))
            syncEffect(() => {
                for (const key of set[funcName]()) {
                    expect(!isArray(key) || isReactive(key)).toBeTruthy()
                }
                replaceEachItems(arr, arrayFrom(set[funcName]()))
            })
            expect(arr).toEqual(arrayFrom(set))
            expect(set[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()

            syncEffect(() => {
                for (const key of sset[funcName]()) {
                    expect(isArray(key) && isReactive(key)).toBeFalsy()
                }
                replaceEachItems(arr, arrayFrom(sset[funcName]()))
            })
            expect(arr).toEqual(arrayFrom(sset))
            expect(sset[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()
        }
    })

    test("entries", () => {
        const set = constReact(new Set([1, 2, 3]))
        expect(arrayFrom(set.entries())).toEqual([
            [1, 1],
            [2, 2],
            [3, 3]
        ])
    })
})

describe("Map prototype methods", () => {
    test("has", () => {
        const map = constReact(new Map())
        syncEffect(() => {
            arr.push(map.has(1), map.size)
        })
        expect(arr).toEqual([false, 0])

        map.set(0, 1)
        expect(arr).toEqual([false, 0, false, 1])

        map.set(1, 2)
        expect(arr).toEqual([false, 0, false, 1, true, 2])

        let sub1 = {}
        let sub2 = constReact(sub1)
        for (let i = 0; i < 2; i++) {
            if (i) {
                ;[sub1, sub2] = [sub2, sub1]
            }
            const map1 = constReact(new Map())
            const map2 = shallowConstReact(new Map())

            map1.set(sub1, null)
            map2.set(sub1, null)
            expect(map1.size).toBe(1)
            expect(map2.size).toBe(1)
            expect(map1.has(sub1)).toBeTruthy()
            expect(map2.has(sub1)).toBeTruthy()
            expect(map1.has(sub2)).toBeTruthy()
            expect(map2.has(sub2)).toBeFalsy()

            map1.set(sub2, null)
            map2.set(sub2, null)
            expect(map1.size).toBe(1)
            expect(map2.size).toBe(2)
        }
    })

    test("get", () => {
        const map = constReact(new Map([[1, null]]))
        syncEffect(() => {
            arr.push(map.get(1), map.get(2))
        })
        expect(arr).toEqual([null, undefined])

        // value not change
        map.set(2, undefined)
        expect(arr).toEqual([null, undefined])

        map.set(2, null)
        expect(arr).toEqual([null, undefined, null, null])
    })

    test("set", () => {
        const map = constReact(new Map())
        map.set()
        expect(map.size).toBe(1)
        expect(map.has(undefined)).toBeTruthy()
        expect(map.get(undefined)).toBeUndefined()

        let sub1 = {}
        let sub2 = constReact(sub1)
        for (let i = 0; i < 2; i++) {
            if (i) {
                ;[sub1, sub2] = [sub2, sub1]
            }

            const map1 = constReact(new Map())
            const map2 = shallowConstReact(new Map())

            syncEffect(() => {
                arr.push(1, map1.get(1))
            })
            syncEffect(() => {
                arr.push(2, map2.get(1))
            })
            emptyArr(arr)

            map1.set(1, sub1)
            map2.set(1, sub1)
            expect(arr).toEqual([1, sub1, 2, sub1])

            // value not change
            map1.set(1, sub2)
            expect(arr).toEqual([1, sub1, 2, sub1])

            map2.set(1, sub2)
            expect(arr).toEqual([1, sub1, 2, sub1, 2, sub1])
        }
    })

    test("delete", () => {
        let sub1 = {}
        let sub2 = constReact(sub1)
        for (let i = 0; i < 2; i++) {
            if (i) {
                ;[sub1, sub2] = [sub2, sub1]
            }
            const map1 = constReact(new Map([[sub1, null]]))
            const map2 = shallowConstReact(new Map([[sub1, null]]))

            map1.delete(sub2)
            map2.delete(sub2)
            expect(map1.size).toBe(0)
            expect(map2.size).toBe(1)

            map2.delete(sub1)
            expect(map2.size).toBe(0)
        }
    })

    test("clear", () => {
        const map = constReact(
            new Map([
                [1, 2],
                [3, 4]
            ])
        )
        syncEffect(() => {
            arr.push(map.size)
        })
        expect(arr).toEqual([2])

        map.clear()
        expect(arr).toEqual([2, 0])

        map.clear()
        expect(arr).toEqual([2, 0])
    })

    test("forEach", () => {
        const map = constReact(new Map([[{}, []]]))
        syncEffect(() => {
            map.forEach(function (this: any, value: any, key: any, caller: any) {
                expect(this).toBe(null)
                expect(caller).toBe(map)
                expect(isReactive(key)).toBeTruthy()
                expect(isReactive(value)).toBeTruthy()
            }, null)
        })
        expect(map[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()
    })

    test("keys", () => {
        const map = constReact(new Map([[{}, []]]))
        syncEffect(() => {
            for (const key of map.keys()) {
                arr.push(key)
                expect(optc(key)).toBe("Object")
                expect(isReactive(key)).toBeTruthy()
            }
        })
        expect(arr).toEqual([{}])
        expect(map[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()
    })

    test("values", () => {
        const map = constReact(new Map([[{}, []]]))
        syncEffect(() => {
            for (const key of map.values()) {
                arr.push(key)
                expect(optc(key)).toBe("Array")
                expect(isReactive(key)).toBeTruthy()
            }
        })
        expect(arr).toEqual([[]])
        expect(map[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()
    })

    test("entries", () => {
        const map = constReact(new Map([[{}, []]]))
        syncEffect(() => {
            for (const entry of map.entries()) {
                arr.push(entry)
                expect(optc(entry[0])).toBe("Object")
                expect(optc(entry[1])).toBe("Array")
                expect(isReactive(entry[0])).toBeTruthy()
                expect(isReactive(entry[1])).toBeTruthy()
            }
        })
        expect(arr).toEqual([[{}, []]])
        expect(map[WRAPPER].s.has(ITERATOR_KEYS)).toBeTruthy()
    })
})
