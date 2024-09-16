import type { VariableDeclaration } from "acorn"

import {
    parse,
    getIdentifiersFromPattern,
    getIdentifiersFromPatternWithPath
} from "../../compiler/estree/tools"
import { arrayFill } from "../../util/shared"
import { test, describe, expect } from "vitest"
import { walk } from "../../compiler/estree/walk"
import { identifierIsReference } from "../../compiler/estree/reference"

const patternSources = [
    `let a,b,c`,
    `const [a, {b: {b}}, [c, [d, [e]]]] = []`,
    `const {a}={}, {b:b}={}, {'c':c}={}, {0:d}={}, {[e]:e}={}`,
    `const { a, b: [b], 'c': { c, d: [d] }, e: [{ e }], [f]: f } = {}`
]
const declaratorsAsts = patternSources.map(source => {
    const declaration = parse(source).body[0] as any as VariableDeclaration
    return declaration.declarations
})

describe("compiler/estree/reference.ts", () => {
    test("object property shorthand", () => {
        let index = 0
        let expectResArr = [true, false, false]
        const ast = parse(`
            obj = { a }
        `)
        walk(ast, {
            Identifier(node, parent) {
                expect(identifierIsReference(node, parent)).toBe(expectResArr[index++])
            }
        })
    })

    test("declarations(variable, function, class)", () => {
        let index = 0
        let expectResArr = [
            ...arrayFill(5, false),
            true,
            false,
            true,
            false,
            true,
            ...arrayFill(8, false)
        ]
        const ast = parse(`
            class A{}
            let b = 20
            const c = 10
            function d(){}
            const e = b
            const f = A
            const g = b = 10
            const { h } = {}
            const [i] = []
            const j = class B{}
            const k = function k(){}
            const l = ()=>{}
        `)
        walk(ast, {
            Identifier(node, parent) {
                expect(identifierIsReference(node, parent)).toBe(expectResArr[index++])
            }
        })
    })

    test("computed property in Property of MemeberDefinition", () => {
        let index = 0
        let expectResArr = [false, true, false, true, true, false, true]
        const ast = parse(`
            const obj = { [a]: 10 }
            class Obj {
                [a](){}
                [b] = 10
                c = b
            }
        `)
        walk(ast, {
            Identifier(node, parent) {
                expect(identifierIsReference(node, parent)).toBe(expectResArr[index++])
            }
        })
    })

    test("access property or element(MemberExpression)", () => {
        let index = 0
        let expectResArr = [false, true, false, true, true]
        const ast = parse(`
            const a = b.c
            c["a"][0][a]
        `)
        walk(ast, {
            Identifier(node, parent) {
                expect(identifierIsReference(node, parent)).toBe(expectResArr[index++])
            }
        })
    })

    test("other syntax", () => {
        let index = 0
        let expectResArr = [...arrayFill(9, true), false, false]
        const ast = parse(`
            a()
            a++
            --b
            c||=true
            d **= false
            \`\${a}\`
            c+d
            new A()
            new (class B{})()
            this.xxx
        `)
        walk(ast, {
            Identifier(node, parent) {
                expect(identifierIsReference(node, parent)).toBe(expectResArr[index++])
            }
        })
    })
})

test("whether [ getIdentifiersFromPattern ] could find all identifiers correctly", () => {
    const res = declaratorsAsts.map(declarators => {
        return declarators.map(declarator => {
            return getIdentifiersFromPattern(declarator.id)
        })
    })
    expect(res).toEqual([
        [["a"], ["b"], ["c"]],
        [["a", "b", "c", "d", "e"]],
        [["a"], ["b"], ["c"], ["d"], ["e"]],
        [["a", "b", "c", "d", "e", "f"]]
    ])
})

test("whether [ getIdentifiersFromPatternWithPath ] could record access path correctly", () => {
    const res = declaratorsAsts.map((declarators, index) => {
        return getIdentifiersFromPatternWithPath(
            patternSources[index],
            declarators.map(declarator => declarator.id)
        )
    })
    expect(res[0]).toEqual(
        new Map([
            ["a", ""],
            ["b", ""],
            ["c", ""]
        ])
    )
    expect(res[1]).toEqual(
        new Map([
            ["a", "[0]"],
            ["b", "[1].b.b"],
            ["c", "[2][0]"],
            ["d", "[2][1][0]"],
            ["e", "[2][1][1][0]"]
        ])
    )
    expect(res[2]).toEqual(
        new Map([
            ["a", ".a"],
            ["b", ".b"],
            ["c", "['c']"],
            ["d", "[0]"],
            ["e", "[e]"]
        ])
    )
    expect(res[3]).toEqual(
        new Map([
            ["a", ".a"],
            ["b", ".b[0]"],
            ["c", "['c'].c"],
            ["d", "['c'].d[0]"],
            ["e", ".e[0].e"],
            ["f", "[f]"]
        ])
    )
})
