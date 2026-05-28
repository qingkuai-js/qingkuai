import ts from "typescript"

import { expect, test } from "vitest"
import {
    isParameterProperty,
    isArrayBindingNameIdentifier
} from "../../../../../src/compiler/ts-ast/assert"
import {
    findFirstChildUntil,
    getVariableDeclareKeyword
} from "../../../../../src/compiler/ts-ast/sundry"
import { walkTsNode } from "../../../../../src/compiler/ts-ast/walk"
import { parseTsScript } from "../../../../../src/util/testing/ts-ast"

function expectIsVarDeclarationList(source: string) {
    const sourceFile = parseTsScript(source)
    const node = findFirstChildUntil(sourceFile, ts.isVariableDeclarationList)
    expect(node, `source: "${source}" should contain variable declaration list`).toBeTruthy()
    return expect(getVariableDeclareKeyword(node!) === "var", `source: "${source}"`)
}

function collectVariableDeclarationLists(source: string) {
    const sourceFile = parseTsScript(source)
    const result: ts.VariableDeclarationList[] = []
    walkTsNode(sourceFile, node => {
        if (ts.isVariableDeclarationList(node)) {
            result.push(node)
        }
    })
    return result
}

test("VariableDeclarationList: var declaration", () => {
    expectIsVarDeclarationList("var a = 1").toBeTruthy()
})

test("VariableDeclarationList: let declaration", () => {
    expectIsVarDeclarationList("let a = 1").toBeFalsy()
})

test("VariableDeclarationList: const declaration", () => {
    expectIsVarDeclarationList("const a = 1").toBeFalsy()
})

test("VariableDeclarationList: using declaration", () => {
    expectIsVarDeclarationList("using a = b()").toBeFalsy()
})

test("VariableDeclarationList: await using declaration", () => {
    expectIsVarDeclarationList("await using a = b()").toBeFalsy()
})

test("VariableDeclarationList: for statement init", () => {
    const lists = collectVariableDeclarationLists(`
        for (var a = 0; a < 1; a++) {}
        for (let b = 0; b < 1; b++) {}
    `)
    expect(lists.length).toBe(2)
    expect(getVariableDeclareKeyword(lists[0]!) === "var").toBeTruthy()
    expect(getVariableDeclareKeyword(lists[1]!) === "var").toBeFalsy()
})

test("VariableDeclarationList: for-in and for-of left declaration", () => {
    const lists = collectVariableDeclarationLists(`
        for (var a in b) {}
        for (let c in d) {}
        for (var e of f) {}
        for (let g of h) {}
    `)
    expect(lists.length).toBe(4)
    expect(getVariableDeclareKeyword(lists[0]!) === "var").toBeTruthy()
    expect(getVariableDeclareKeyword(lists[1]!) === "var").toBeFalsy()
    expect(getVariableDeclareKeyword(lists[2]!) === "var").toBeTruthy()
    expect(getVariableDeclareKeyword(lists[3]!) === "var").toBeFalsy()
})

test("Binding element: array binding identifier detection", () => {
    const omittedSource = parseTsScript("const [, a] = arr")
    const omitted = findFirstChildUntil(omittedSource, ts.isOmittedExpression)
    expect(omitted).toBeTruthy()
    expect(isArrayBindingNameIdentifier(omitted!)).toBe(false)

    const restSource = parseTsScript("const [...a] = arr")
    const rest = findFirstChildUntil(restSource, ts.isBindingElement)
    expect(rest).toBeTruthy()
    expect(isArrayBindingNameIdentifier(rest!)).toBe(false)

    const idSource = parseTsScript("const [a] = arr")
    const idElement = findFirstChildUntil(idSource, ts.isBindingElement)
    expect(idElement).toBeTruthy()
    expect(isArrayBindingNameIdentifier(idElement!)).toBe(true)

    const patternSource = parseTsScript("const [{ a }] = arr")
    const patternElement = findFirstChildUntil(patternSource, ts.isBindingElement)
    expect(patternElement).toBeTruthy()
    expect(isArrayBindingNameIdentifier(patternElement!)).toBe(false)
})

test("Parameter declaration: parameter property modifiers", () => {
    const sources = [
        "class A { constructor(public a: number) {} }",
        "class B { constructor(private b: number) {} }",
        "class C { constructor(protected c: number) {} }",
        "class D { constructor(readonly d: number) {} }"
    ]

    for (const source of sources) {
        const sourceFile = parseTsScript(source)
        const parameter = findFirstChildUntil(sourceFile, ts.isParameter)
        expect(parameter).toBeTruthy()
        expect(isParameterProperty(parameter!)).toBe(true)
    }
})
