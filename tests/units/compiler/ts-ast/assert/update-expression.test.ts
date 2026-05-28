import ts from "typescript"

import { expect, test } from "vitest"
import { inputDescriptor } from "../../../../../src/compiler/state"
import { parseExpression } from "../../../../../src/compiler/parser/script"
import { isUpdateExpression } from "../../../../../src/compiler/ts-ast/assert"

function expectIsUpdateExpression<T extends ts.Node>(source: string) {
    const expression = parseExpression(source, 0)!
    inputDescriptor.script.isTS = true
    return expect(isUpdateExpression(expression), `source: "${source}"`)
}

test("Basic update expressions", () => {
    expectIsUpdateExpression("a++").toBeTruthy()
    expectIsUpdateExpression("++b").toBeTruthy()
    expectIsUpdateExpression("c--").toBeTruthy()
    expectIsUpdateExpression("--d").toBeTruthy()
    expectIsUpdateExpression("e + 1").toBeFalsy()
    expectIsUpdateExpression("+f").toBeFalsy()
    expectIsUpdateExpression("-g").toBeFalsy()
})

test("Mixed type-operations with update expressions", () => {
    expectIsUpdateExpression("++(a as number)").toBeTruthy()
    expectIsUpdateExpression("--(b satisfies number)").toBeTruthy()
    expectIsUpdateExpression("++(<number>c)").toBeTruthy()
    expectIsUpdateExpression("--(d!)").toBeTruthy()
    expectIsUpdateExpression("++((e as number)!)").toBeTruthy()
    expectIsUpdateExpression("--((<number>f) satisfies number)").toBeTruthy()
})

test("Parenthesized expressions around update expressions", () => {
    expectIsUpdateExpression("(a++)").toBeTruthy()
    expectIsUpdateExpression("((++b))").toBeTruthy()
    expectIsUpdateExpression("((c--))").toBeTruthy()
    expectIsUpdateExpression("(--d)").toBeTruthy()
    expectIsUpdateExpression("((e + 1))").toBeFalsy()
})
