import ts from "typescript"

import { beforeEach, expect, test } from "vitest"
import { resetCompilerState } from "../../../../src/compiler/state"
import { parseExpression } from "../../../../src/compiler/parser/script"
import { getRawToRawArgumentRange } from "../../../../src/compiler/optimizer/raw"

function parseRawCall(source: string) {
    const expression = parseExpression(source, 0)
    if (!expression || !ts.isCallExpression(expression)) {
        throw new Error(`Expected a call expression for: ${source}`)
    }
    return expression
}

beforeEach(() => {
    resetCompilerState({})
})

test("getRawToRawArgumentRange returns the identifier argument range", () => {
    expect(getRawToRawArgumentRange(parseRawCall("raw(config)"))).toEqual([4, 10])
})

test("getRawToRawArgumentRange returns undefined for non-identifier arguments", () => {
    expect(getRawToRawArgumentRange(parseRawCall("raw(config.value)"))).toBeUndefined()
    expect(getRawToRawArgumentRange(parseRawCall("raw(foo())"))).toBeUndefined()
})

test("getRawToRawArgumentRange unwraps type operations on the argument", () => {
    expect(getRawToRawArgumentRange(parseRawCall("raw(config as any)"))).toEqual([4, 10])
    expect(getRawToRawArgumentRange(parseRawCall("raw(config!)"))).toEqual([4, 10])
    expect(getRawToRawArgumentRange(parseRawCall("raw(config satisfies Config)"))).toEqual([4, 10])
})

test("getRawToRawArgumentRange unwraps parentheses and nested type operations", () => {
    expect(getRawToRawArgumentRange(parseRawCall("raw((config))"))).toEqual([5, 11])
    expect(getRawToRawArgumentRange(parseRawCall("raw((config as any)!)"))).toEqual([5, 11])
    expect(getRawToRawArgumentRange(parseRawCall("raw((config as any)! as Config)"))).toEqual([
        5, 11
    ])
})

test("getRawToRawArgumentRange returns undefined for spread and non-single arguments", () => {
    expect(getRawToRawArgumentRange(parseRawCall("raw(...items)"))).toBeUndefined()
    expect(getRawToRawArgumentRange(parseRawCall("raw()"))).toBeUndefined()
    expect(getRawToRawArgumentRange(parseRawCall("raw(a, b)"))).toBeUndefined()
})
