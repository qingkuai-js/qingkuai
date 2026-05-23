import ts from "typescript"

import { expect, test } from "vitest"
import {
    isTypeOperation,
    isUpdateExpression,
    isAssignmentExpression
} from "../../../../../src/compiler/ts-ast/assert"
import { parseTsScript } from "../../../../../src/util/testing/ts-ast"
import { findFirstChildUntil } from "../../../../../src/compiler/ts-ast/sundry"

function expectIsTypeOperation<T extends ts.Node>(
    source: string,
    predicate: (node: ts.Node) => node is T
) {
    const sourceFile = parseTsScript(source)
    const node = findFirstChildUntil(sourceFile, predicate)
    expect(node, `source: "${source}" should contain target node`).toBeTruthy()
    return expect(isTypeOperation(node!), `source: "${source}"`)
}

function expectIsAssignmentExpression<T extends ts.Node>(
    source: string,
    predicate: (node: ts.Node) => node is T
) {
    const sourceFile = parseTsScript(source)
    const node = findFirstChildUntil(sourceFile, predicate)
    expect(node, `source: "${source}" should contain target node`).toBeTruthy()
    return expect(isAssignmentExpression(node!), `source: "${source}"`)
}

function expectIsUpdateExpression<T extends ts.Node>(
    source: string,
    predicate: (node: ts.Node) => node is T
) {
    const sourceFile = parseTsScript(source)
    const node = findFirstChildUntil(sourceFile, predicate)
    expect(node, `source: "${source}" should contain target node`).toBeTruthy()
    return expect(isUpdateExpression(node!), `source: "${source}"`)
}

test("type operation: as expression", () => {
    expectIsTypeOperation("const a = b as number", ts.isAsExpression).toBeTruthy()
})

test("type operation: type assertion", () => {
    expectIsTypeOperation("const c = <number>d", ts.isTypeAssertionExpression).toBeTruthy()
})

test("type operation: non-null", () => {
    expectIsTypeOperation("const e = f!", ts.isNonNullExpression).toBeTruthy()
})

test("type operation: satisfies", () => {
    expectIsTypeOperation("const g = h satisfies number", ts.isSatisfiesExpression).toBeTruthy()
})

test("type operation: plain binary expression is false", () => {
    expectIsTypeOperation("const i = j + 1", ts.isBinaryExpression).toBeFalsy()
})

test("assignment with type operation wrapper", () => {
    expectIsAssignmentExpression("((b as number)) += 1", ts.isBinaryExpression).toBeTruthy()
    expectIsAssignmentExpression("((b satisfies number)) ||= 1", ts.isBinaryExpression).toBeTruthy()
    expectIsAssignmentExpression("((<number>b)) ??= 1", ts.isBinaryExpression).toBeTruthy()
})

test("update expression with type operation wrapper", () => {
    expectIsUpdateExpression("(b!)++", ts.isPostfixUnaryExpression).toBeTruthy()
    expectIsUpdateExpression("((b as number))++", ts.isPostfixUnaryExpression).toBeTruthy()
    expectIsUpdateExpression("((b satisfies number))++", ts.isPostfixUnaryExpression).toBeTruthy()
    expectIsUpdateExpression("++((<number>b))", ts.isPrefixUnaryExpression).toBeTruthy()
    expectIsUpdateExpression("++((b as number))", ts.isPrefixUnaryExpression).toBeTruthy()
    expectIsUpdateExpression("--((b satisfies number))", ts.isPrefixUnaryExpression).toBeTruthy()
})

test("plain binary expression remains non-assignment", () => {
    expectIsAssignmentExpression("(b satisfies number) + 1", ts.isBinaryExpression).toBeFalsy()
})
