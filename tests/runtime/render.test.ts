import { test, expect, describe } from "vitest"
import { transformClassName } from "../../runtime/dom"

describe("test class transform when value in array or object format.", () => {
    test("array format", () => {
        expect(transformClassName([1, 2, 3])).toBe("1 2 3")
    })

    test("object format", () => {
        expect(
            transformClassName({
                a: true,
                b: false
            })
        ).toBe("a")
    })

    test("object format with truthy value", () => {
        expect(
            transformClassName({
                a: true,
                b: "",
                c: "false",
                d: []
            })
        ).toBe("a c d")
    })

    test("combined format of array and object", () => {
        expect(
            transformClassName([
                "a",
                "b",
                {
                    a: true,
                    b: false,
                    c: 1,
                    d: 0
                }
            ])
        ).toBe("a b a c")

        expect(
            transformClassName([
                "a",
                ["b", "c"],
                {
                    d: 1,
                    e: false,
                    f: 2
                },
                ["g", "h", ["i", ["j"]]]
            ])
        ).toBe("a b c d f g h i j")
    })
})
