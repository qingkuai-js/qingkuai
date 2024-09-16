import { expect, test, describe } from "vitest"
import { findOutOfSC, getPieceOfStrOutOfER } from "../../util/compiler"

describe("util/compiler: findOutOfSC", () => {
    test("with string", () => {
        expect(findOutOfSC("1'2'3", "2")).toBe(-1)
        expect(findOutOfSC('1"23', "2")).toBe(-1)
        expect(findOutOfSC("1'23", "2")).toBe(-1)
        expect(findOutOfSC("1'22'3", /22/)).toBe(-1)
        expect(findOutOfSC("1\\'23", "2")).toBe(-1)
        expect(findOutOfSC("1\\\\'23", "2")).toBe(-1)
        expect(findOutOfSC("1`\\`23", "2")).toBe(-1)
        expect(findOutOfSC("\"1\"2`3''", "2")).toBe(3)
        expect(findOutOfSC("'\\'123", "2")).toBe(-1)
    })

    test("with comment", () => {
        expect(findOutOfSC("1//2\n3", "2")).toBe(-1)
        expect(findOutOfSC("1/*2*/3", "2")).toBe(-1)
        expect(findOutOfSC("1//2//3", "2")).toBe(-1)
        expect(findOutOfSC("1/** 2 */*/3", "2")).toBe(-1)
        expect(findOutOfSC("1//''2\n3", "2")).toBe(-1)
        expect(findOutOfSC("1//''2\n3", "3")).toBe(7)
        expect(findOutOfSC("1\\//2\n3", "2")).toBe(-1)
    })

    test("with the combination of string and commment", () => {
        expect(findOutOfSC("1'/**/2'3", "2")).toBe(-1)
        expect(findOutOfSC("1''/**/23", "2")).toBe(7)
        expect(findOutOfSC("1''//\n/**/23", "2")).toBe(10)
        expect(findOutOfSC("1'2'/**/3", "2")).toBe(-1)
        expect(findOutOfSC("1/*''2*/3", "2")).toBe(-1)
        expect(findOutOfSC("1'/*'*/23", "2")).toBe(7)
        expect(findOutOfSC("1/*`*/2`3", "2")).toBe(6)
        expect(findOutOfSC("1`//xxx/*`234", /2\d+/)).toBe(10)
    })

    test("without string and comment, test general mode", () => {
        expect(findOutOfSC("123", "2")).toBe(1)
        expect(findOutOfSC("1223", /22/)).toBe(1)
        expect(findOutOfSC("123444", /4{3}/)).toBe(3)
        expect(findOutOfSC("s123456xxx", /^s\d{6}/)).toBe(0)
    })
})

describe("util/compiler: getPieceOfStrOutOfER", () => {
    test("single range", () => {
        expect(getPieceOfStrOutOfER("123", 0, 3, [])).toBe("123")
        expect(getPieceOfStrOutOfER("123456", 0, 6, [[1, 2]])).toBe("13456")
        expect(getPieceOfStrOutOfER("123456789", 0, 9, [[0, 100]])).toBe("")
        expect(getPieceOfStrOutOfER("123456789", 3, 6, [[4, 5]])).toBe("46")
        expect(getPieceOfStrOutOfER("123456789", 5, 9, [[3, 6]])).toBe("789")
        expect(getPieceOfStrOutOfER("123456789", 2, 6, [[3, 8]])).toBe("3")
        expect(getPieceOfStrOutOfER("123456789", 4, 6, [[3, 8]])).toBe("")
    })

    test("multiple ranges", () => {
        expect(
            getPieceOfStrOutOfER("123456", 0, 6, [
                [1, 2],
                [2, 3]
            ])
        ).toBe("1456")

        expect(
            getPieceOfStrOutOfER("abcdefghijklmnopqrstuvwxyz0123456789", 0, 36, [
                [0, 1],
                [4, 5],
                [10, 17],
                [33, 100]
            ])
        ).toBe("bcdfghijrstuvwxyz0123456")

        expect(
            getPieceOfStrOutOfER("abcdefghijklmnopqrstuvwxyz0123456789", 0, 36, [
                [3, 6],
                [9, 12],
                [15, 18],
                [21, 24],
                [27, 30],
                [33, 36]
            ])
        ).toBe("abcghimnostuyz0456")

        expect(
            getPieceOfStrOutOfER("abcdefghijklmnopqrstuvwxyz0123456789", 0, 36, [
                [10, 20],
                [30, 40]
            ])
        ).toBe("abcdefghijuvwxyz0123")
    })
})
