import ts from "typescript"

import { expect, test } from "vitest"
import {
    isScopeBoundary,
    isNonHoistableScopeBoundary
} from "../../../../../src/compiler/ts-ast/assert"
import { parseTsScript } from "../../../../../src/util/testing/ts-ast"
import { findFirstChildUntil } from "../../../../../src/compiler/ts-ast/sundry"

test("ScopeBoundary: source file", () => {
    const sourceFile = parseTsScript(`const value = 1`)
    expect(isScopeBoundary(sourceFile)).toBeTruthy()
})

test("ScopeBoundary: module block", () => {
    const sourceFile = parseTsScript(`
        namespace foo {
            const value = 1
        }
    `)
    const moduleBlock = findFirstChildUntil(sourceFile, ts.isModuleBlock)!
    expect(isScopeBoundary(moduleBlock)).toBeTruthy()
})

test("ScopeBoundary: function block", () => {
    const sourceFile = parseTsScript(`
        function bar() {
            const value = 2
        }
    `)
    const functionBlock = findFirstChildUntil(sourceFile, (node): node is ts.Block => {
        return ts.isBlock(node) && !!node.parent && ts.isFunctionDeclaration(node.parent)
    })!
    expect(isScopeBoundary(functionBlock)).toBeTruthy()
})

test("ScopeBoundary: function declaration is false", () => {
    const sourceFile = parseTsScript(`function bar() {}`)
    const functionDeclaration = findFirstChildUntil(sourceFile, ts.isFunctionDeclaration)!
    expect(isScopeBoundary(functionDeclaration)).toBeFalsy()
})

test("ScopeBoundary: catch clause", () => {
    const sourceFile = parseTsScript(`
        try {
            a()
        } catch (b) {
            c()
        }
    `)
    const catchClause = findFirstChildUntil(sourceFile, ts.isCatchClause)!
    expect(isScopeBoundary(catchClause)).toBeFalsy()
})

test("ScopeBoundary: case clause", () => {
    const sourceFile = parseTsScript(`
        switch (a) {
            case b:
                c()
        }
    `)
    const caseClause = findFirstChildUntil(sourceFile, ts.isCaseClause)!
    expect(isScopeBoundary(caseClause)).toBeTruthy()
})

test("NonHoistable: source file", () => {
    const sourceFile = parseTsScript(`const value = 1`)
    expect(isNonHoistableScopeBoundary(sourceFile)).toBeTruthy()
})

test("NonHoistable: module block", () => {
    const sourceFile = parseTsScript(`
        namespace foo {
            const value = 1
        }
    `)
    const moduleBlock = findFirstChildUntil(sourceFile, ts.isModuleBlock)!
    expect(isNonHoistableScopeBoundary(moduleBlock)).toBeTruthy()
})

test("NonHoistable: function block", () => {
    const sourceFile = parseTsScript(`
        function outer() {
            const value = 2
        }
    `)
    const functionBlock = findFirstChildUntil(sourceFile, (node): node is ts.Block => {
        return ts.isBlock(node) && !!node.parent && ts.isFunctionDeclaration(node.parent)
    })!
    expect(isNonHoistableScopeBoundary(functionBlock)).toBeTruthy()
})

test("NonHoistable: class method block", () => {
    const sourceFile = parseTsScript(`
        class Example {
            method() {
                const nested = 3
            }
        }
    `)
    const classMethodBlock = findFirstChildUntil(sourceFile, (node): node is ts.Block => {
        return ts.isBlock(node) && !!node.parent && ts.isMethodDeclaration(node.parent)
    })!
    expect(isNonHoistableScopeBoundary(classMethodBlock)).toBeTruthy()
})

test("NonHoistable: constructor block", () => {
    const sourceFile = parseTsScript(`
        class Example {
            constructor() {
                const nested = 4
            }
        }
    `)
    const constructorBlock = findFirstChildUntil(sourceFile, (node): node is ts.Block => {
        return ts.isBlock(node) && !!node.parent && ts.isConstructorDeclaration(node.parent)
    })!
    expect(isNonHoistableScopeBoundary(constructorBlock)).toBeTruthy()
})

test("NonHoistable: get accessor block", () => {
    const sourceFile = parseTsScript(`
        class Example {
            get accessor() {
                const nested = 5
                return nested
            }
        }
    `)
    const getAccessorBlock = findFirstChildUntil(sourceFile, (node): node is ts.Block => {
        return ts.isBlock(node) && !!node.parent && ts.isGetAccessorDeclaration(node.parent)
    })!
    expect(isNonHoistableScopeBoundary(getAccessorBlock)).toBeTruthy()
})

test("NonHoistable: set accessor block", () => {
    const sourceFile = parseTsScript(`
        class Example {
            set accessor(value: number) {
                const nested = 6
            }
        }
    `)
    const setAccessorBlock = findFirstChildUntil(sourceFile, (node): node is ts.Block => {
        return ts.isBlock(node) && !!node.parent && ts.isSetAccessorDeclaration(node.parent)
    })!
    expect(isNonHoistableScopeBoundary(setAccessorBlock)).toBeTruthy()
})

test("NonHoistable: arrow function block body", () => {
    const sourceFile = parseTsScript(`
        const arrowBlock = () => {
            const nested = 7
        }
    `)
    const arrowBlock = findFirstChildUntil(sourceFile, (node): node is ts.Block => {
        return ts.isBlock(node) && !!node.parent && ts.isArrowFunction(node.parent)
    })!
    expect(isNonHoistableScopeBoundary(arrowBlock)).toBeTruthy()
})

test("NonHoistable: arrow function expression body", () => {
    const sourceFile = parseTsScript(`
        const arrowExpression = () => 8
    `)
    const arrowExpression = findFirstChildUntil(sourceFile, ts.isArrowFunction)!.body
    expect(isNonHoistableScopeBoundary(arrowExpression)).toBeTruthy()
})

test("NonHoistable: if block is false", () => {
    const sourceFile = parseTsScript(`
        if (true) {
            const value = 9
        }
    `)
    const ifBlock = findFirstChildUntil(sourceFile, (node): node is ts.Block => {
        return ts.isBlock(node) && !!node.parent && ts.isIfStatement(node.parent)
    })!
    expect(isNonHoistableScopeBoundary(ifBlock)).toBeFalsy()
})

test("NonHoistable: catch clause is false", () => {
    const sourceFile = parseTsScript(`
        try {
            a()
        } catch (b) {
            c()
        }
    `)
    const catchClause = findFirstChildUntil(sourceFile, ts.isCatchClause)!
    expect(isNonHoistableScopeBoundary(catchClause)).toBeFalsy()
})
