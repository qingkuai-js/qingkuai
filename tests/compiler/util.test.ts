import { expect, test, describe, it } from "vitest"
import { getPieceOfStrOutOfER } from "../../src/util/compiler/sundry"
import { findOutOfStringComment } from "../../src/util/compiler/strings"

describe.only("util/compiler: findOutOfSC", () => {
    it("should match the pattern out of string ranges", () => {
        expect(findOutOfStringComment("1'2'3", "2")).toBe(-1)
        expect(findOutOfStringComment('1"23', "2")).toBe(-1)
        expect(findOutOfStringComment("1'23", "2")).toBe(-1)
        expect(findOutOfStringComment("1'22'3", /22/)).toBe(-1)
        expect(findOutOfStringComment("1\\'23", "2")).toBe(-1)
        expect(findOutOfStringComment("1\\\\'23", "2")).toBe(-1)
        expect(findOutOfStringComment("1`\\`23", "2")).toBe(-1)
        expect(findOutOfStringComment("\"1\"2`3''", "2")).toBe(3)
        expect(findOutOfStringComment("'\\'123", "2")).toBe(-1)
    })

    it("should match the pattern out of the comment ranges", () => {
        expect(findOutOfStringComment("1//2\n3", "2")).toBe(-1)
        expect(findOutOfStringComment("1/*2*/3", "2")).toBe(-1)
        expect(findOutOfStringComment("1//2//3", "2")).toBe(-1)
        expect(findOutOfStringComment("1/** 2 */*/3", "2")).toBe(-1)
        expect(findOutOfStringComment("1//''2\n3", "2")).toBe(-1)
        expect(findOutOfStringComment("1//''2\n3", "3")).toBe(7)
        expect(findOutOfStringComment("1\\//2\n3", "2")).toBe(-1)
    })

    it("should match the pattern out the the string and comment ranges", () => {
        expect(findOutOfStringComment("1'/**/2'3", "2")).toBe(-1)
        expect(findOutOfStringComment("1''/**/23", "2")).toBe(7)
        expect(findOutOfStringComment("1''//\n/**/23", "2")).toBe(10)
        expect(findOutOfStringComment("1'2'/**/3", "2")).toBe(-1)
        expect(findOutOfStringComment("1/*''2*/3", "2")).toBe(-1)
        expect(findOutOfStringComment("1'/*'*/23", "2")).toBe(7)
        expect(findOutOfStringComment("1/*`*/2`3", "2")).toBe(6)
        expect(findOutOfStringComment("1`//xxx/*`234", /2\d+/)).toBe(10)
    })

    test("whether findOutOfSC function works for mornal target without string and comment", () => {
        expect(findOutOfStringComment("123", "2")).toBe(1)
        expect(findOutOfStringComment("1223", /22/)).toBe(1)
        expect(findOutOfStringComment("123444", /4{3}/)).toBe(3)
        expect(findOutOfStringComment("s123456xxx", /^s\d{6}/)).toBe(0)
    })
})

describe("util/compiler: getPieceOfStrOutOfER", () => {
    it("should return a result that ignored characters in single range", () => {
        expect(getPieceOfStrOutOfER("123", 0, 3, new Set())).toBe("123")
        expect(getPieceOfStrOutOfER("123456", 0, 6, new Set([[1, 2]]))).toBe("13456")
        expect(getPieceOfStrOutOfER("123456789", 0, 9, new Set([[0, 100]]))).toBe("")
        expect(getPieceOfStrOutOfER("123456789", 3, 6, new Set([[4, 5]]))).toBe("46")
        expect(getPieceOfStrOutOfER("123456789", 5, 9, new Set([[3, 6]]))).toBe("789")
        expect(getPieceOfStrOutOfER("123456789", 2, 6, new Set([[3, 8]]))).toBe("3")
        expect(getPieceOfStrOutOfER("123456789", 4, 6, new Set([[3, 8]]))).toBe("")
    })

    it("should return a result that ignored characters in mutiple ranges", () => {
        expect(
            getPieceOfStrOutOfER(
                "123456",
                0,
                6,
                new Set([
                    [1, 2],
                    [2, 3]
                ])
            )
        ).toBe("1456")

        expect(
            getPieceOfStrOutOfER(
                "abcdefghijklmnopqrstuvwxyz0123456789",
                0,
                36,
                new Set([
                    [0, 1],
                    [4, 5],
                    [10, 17],
                    [33, 100]
                ])
            )
        ).toBe("bcdfghijrstuvwxyz0123456")

        expect(
            getPieceOfStrOutOfER(
                "abcdefghijklmnopqrstuvwxyz0123456789",
                0,
                36,
                new Set([
                    [3, 6],
                    [9, 12],
                    [15, 18],
                    [21, 24],
                    [27, 30],
                    [33, 36]
                ])
            )
        ).toBe("abcghimnostuyz0456")

        expect(
            getPieceOfStrOutOfER(
                "abcdefghijklmnopqrstuvwxyz0123456789",
                0,
                36,
                new Set([
                    [10, 20],
                    [30, 40]
                ])
            )
        ).toBe("abcdefghijuvwxyz0123")
    })
})
