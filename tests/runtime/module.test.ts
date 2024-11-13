import type { AnyObject } from "../../util/types"

import { describe, expect, test } from "vitest"
import { getKeyValuePairIterator } from "../../runtime/module"

const nonTraversableRE = /non-traversable/
const objectStringLiteral = "[object Object]"

describe("test getKeyValuePairIterator function", () => {
    test("number", () => {
        const res = getKeyValuePairIterator(10)
        expect(res.length).toBe(10)
        expect(res).toEqual(
            Array(10)
                .fill(0)
                .map((_, index) => {
                    return [index, index + 1]
                })
        )
        expect(getKeyValuePairIterator(0)).toEqual([])
    })
    
    test("string", () => {
        const str = "QingKuai"
        const res = getKeyValuePairIterator(str)
        expect(res.length).toBe(8)
        expect(res).toEqual(
            str.split("").map((item, index) => {
                return [index.toString(), item]
            })
        )
    })

    test("normal Set", () => {
        const setArr = [1, 2, 3, 3]
        const set = new Set(setArr)
        const res = getKeyValuePairIterator(set)
        expect(res.length).toBe(3)
        expect(res).toEqual([
            [0, 1],
            [1, 2],
            [2, 3]
        ])
    })

    test("normal Map", () => {
        const mapArr: [string, number][] = [
            ["a", 1],
            ["b", 2],
            ["c", 3]
        ]
        const map = new Map(mapArr)
        const res = getKeyValuePairIterator(map)
        expect(res.length).toBe(3)
        expect(res).toEqual(mapArr)
    })

    test("Set with key or value of type pointer", () => {
        const setArr = [{ a: 1 }, [1, 2, 3], null]
        const set = new Set(setArr)
        const res = getKeyValuePairIterator(set)
        expect(res).toEqual(
            setArr.map((item, index) => {
                return [index, item]
            })
        )
        expect(res[2]).toEqual([2, null])
    })

    test("Map with key or value of type pointer", () => {
        const mapArr: [AnyObject, any][] = [
            [{ a: 1 }, 1],
            [{ b: 2 }, { c: 3 }]
        ]
        const map = new Map(mapArr)
        const res = getKeyValuePairIterator(map)
        expect(res).toEqual(mapArr)
        expect(res[0][1]).toBe(1)
        expect(res[0][0] + "").toBe(objectStringLiteral)
        expect(res[1][0] + "").toBe(objectStringLiteral)
        expect(res[1][1] + "").toBe(objectStringLiteral)
    })

    test("value that is non-traversable: NaN/null/undefined...", () => {
        expect(() => getKeyValuePairIterator(NaN)).toThrowError(nonTraversableRE)
        expect(() => getKeyValuePairIterator(null)).toThrowError(nonTraversableRE)
        expect(() => getKeyValuePairIterator(true)).toThrowError(nonTraversableRE)
        expect(() => getKeyValuePairIterator(false)).toThrowError(nonTraversableRE)
        expect(() => getKeyValuePairIterator(void 0)).toThrowError(nonTraversableRE)
        expect(() => getKeyValuePairIterator(Symbol())).toThrowError(nonTraversableRE)
    })
})
