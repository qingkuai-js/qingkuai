import type { ExpectedCompileMessage, ExpectedTopLevelIdentifier } from "#type-declarations/testing"

import { expect, test } from "vitest"
import { analyzeResult } from "../../../src/compiler/state"
import { objectKeys } from "../../../src/util/shared/aliases"
import { traverseObject } from "../../../src/util/shared/sundry"
import { formatSourceCode } from "../../../src/util/testing/sundry"
import { analyzeScript } from "../../../src/compiler/analyzer/script"
import { matchCompileMessages } from "../../../src/util/testing/match"
import { parseTemplateStandalone } from "../../../src/compiler/parser/template"

function localAnalyze(source: string) {
    parseTemplateStandalone(`<lang-ts>${formatSourceCode(source)}</lang-ts>`, {
        recover: true
    })
    analyzeScript()
}

function localMatchCompileMessages(expected: ExpectedCompileMessage[]) {
    for (const item of expected) {
        item.range[0] += 9
        item.range[1] += 9
    }
    matchCompileMessages(expected)
}

function checkTopLevelIdentifiers(expected: ExpectedTopLevelIdentifier[]) {
    traverseObject(analyzeResult.script.topLevelIdentifiers, (key, value, index) => {
        expect({
            name: key,
            hoist: value.hoist,
            status: value.status,
            implicit: value.implicit
        }).toEqual(expected[index])
    })
    for (const item of expected) {
        expect(
            !!analyzeResult.script.topLevelIdentifiers[item.name],
            `The identifier "${item.name}" does not exist in topLevelIdentifiers`
        ).toBeTruthy()
    }
}

test("Variable declarations with key: let, const", () => {
    localAnalyze(`
        let a
        let b = reactive()
        let c = shallow()
        let d = (derived satisfies any)(()=>{})

        const {e, f: g = h, ...i} = {}
        const [j, k = l, [m = n] = o, ...[p = q, ...r]] = shallow?.([])
    `)
    checkTopLevelIdentifiers([
        {
            name: "a",
            hoist: false,
            implicit: true,
            status: "literal"
        },
        {
            name: "b",
            hoist: false,
            implicit: false,
            status: "reactive"
        },
        {
            name: "c",
            hoist: false,
            implicit: false,
            status: "shallow"
        },
        {
            name: "d",
            hoist: false,
            implicit: false,
            status: "derived"
        },
        ...["e", "g", "i"].map(name => {
            return {
                name,
                hoist: false,
                implicit: true,
                status: "pending"
            } satisfies ExpectedTopLevelIdentifier
        }),
        ...["j", "k", "m", "p", "r"].map(name => {
            return {
                name,
                hoist: false,
                implicit: false,
                status: "shallow"
            } satisfies ExpectedTopLevelIdentifier
        })
    ])
    expect(objectKeys(analyzeResult.script.topLevelIdentifiers).length).toBe(12)
})

test("Variable declaration with key: var", () => {
    localAnalyze(`
        var a
        var {
            b,
            c = d,
            e: f = g,
            h: {
                i = j
            } = k,
            ...l
        } = reactive!()

        if(true){
            var m
            for(var n;;){
                var o = ()=>{
                    var p
                }
            }
        }

        var [q, r = s, ...t] = (shallow as any)()
    `)
    checkTopLevelIdentifiers([
        {
            name: "a",
            hoist: true,
            implicit: true,
            status: "literal"
        },
        ...["b", "c", "f", "i", "l"].map(name => {
            return {
                name,
                hoist: true,
                implicit: false,
                status: "reactive"
            } satisfies ExpectedTopLevelIdentifier
        }),
        ...["m", "n", "o"].map(name => {
            return {
                name,
                hoist: true,
                implicit: true,
                status: "literal"
            } satisfies ExpectedTopLevelIdentifier
        }),
        ...["q", "r", "t"].map(name => {
            return {
                name,
                hoist: true,
                implicit: false,
                status: "shallow"
            } satisfies ExpectedTopLevelIdentifier
        })
    ])
    expect(objectKeys(analyzeResult.script.topLevelIdentifiers).length).toBe(12)
})

test("Typescript enum declarations", () => {
    localAnalyze(`
        enum a{}
        const enum b{}
    `)
    checkTopLevelIdentifiers([
        ...["a", "b"].map(name => {
            return {
                name,
                hoist: false,
                implicit: true,
                status: "pending"
            } satisfies ExpectedTopLevelIdentifier
        })
    ])
})

test("Function declarations", () => {
    localAnalyze(`
        function a(){}

        if(true){
            function b(){}
        }
    `)
    checkTopLevelIdentifiers([
        {
            name: "a",
            hoist: true,
            implicit: true,
            status: "literal"
        }
    ])
})

test("Class declarations", () => {
    localAnalyze(`
        class A{}

        if(true){
            class B{}
        }
    `)
    checkTopLevelIdentifiers([
        {
            name: "A",
            hoist: false,
            implicit: true,
            status: "literal"
        }
    ])
})

test("Redeclarations for derived reactive value", () => {
    const unnecessaryDerived = `The derived reactive value is read-only and cannot be explicitly mutated. Declaring it as mutable is unnecessary, consider declaring it with \`const\`.`

    localAnalyze(`
        var a
        var a = reactive()

        var b
        var b = reactive()
        var b = raw()

        var c = derived(()=>{})
        var c

        var d = shallow()
        {
            var d = 1
        }

        var e
        var e = derived(_)

        var f = derived(_)
        var f = derived(_)

        var $g = ()=>{}
        var $g = _

        var c
        var h = 1
        
        var i = 1
        var i = 2
    `)
    checkTopLevelIdentifiers([
        {
            name: "a",
            hoist: true,
            implicit: false,
            status: "reactive"
        },
        {
            name: "b",
            hoist: true,
            implicit: false,
            status: "raw"
        },
        {
            name: "c",
            hoist: true,
            implicit: false,
            status: "derived"
        },
        {
            name: "d",
            hoist: true,
            implicit: false,
            status: "shallow"
        },
        {
            name: "e",
            hoist: true,
            implicit: false,
            status: "derived"
        },
        {
            name: "f",
            hoist: true,
            implicit: false,
            status: "derived"
        },
        {
            name: "$g",
            hoist: true,
            implicit: false,
            status: "derived"
        },
        {
            name: "h",
            hoist: true,
            implicit: true,
            status: "literal"
        },
        {
            name: "i",
            hoist: true,
            implicit: true,
            status: "pending"
        }
    ])
    localMatchCompileMessages([
        {
            type: "warning",
            range: [70, 89],
            value: unnecessaryDerived
        },
        {
            type: "error",
            range: [94, 95],
            value: `The identifier cannot be redeclared when it is marked as a derived reactive value.`
        },
        {
            type: "warning",
            range: [144, 158],
            value: unnecessaryDerived
        },
        {
            type: "error",
            range: [138, 139],
            value: `The identifier cannot be redeclared when it is marked as a derived reactive value.`
        },
        {
            type: "warning",
            range: [164, 178],
            value: unnecessaryDerived
        },
        {
            type: "warning",
            range: [183, 197],
            value: unnecessaryDerived
        },
        {
            type: "error",
            range: [183, 184],
            value: `The identifier cannot be redeclared when it is marked as a derived reactive value.`
        },
        {
            type: "warning",
            range: [203, 214],
            value: unnecessaryDerived
        },
        {
            type: "warning",
            range: [219, 225],
            value: unnecessaryDerived
        },
        {
            type: "error",
            range: [219, 221],
            value: `The identifier cannot be redeclared when it is marked as a derived reactive value.`
        },
        {
            type: "error",
            range: [231, 232],
            value: `The identifier cannot be redeclared when it is marked as a derived reactive value.`
        }
    ])
})

test("Redeclarations for alias", () => {
    localAnalyze(`
        var a = alias(_._)
        var a
        var b
        var b = alias(_._)
        var c = alias(_._)
        var c = alias(_._)
    `)
    localMatchCompileMessages([
        {
            type: "error",
            range: [23, 24],
            value: `The identifier cannot be redeclared when it is marked as an alias.`
        },
        {
            type: "error",
            range: [29, 30],
            value: `The identifier cannot be redeclared when it is marked as an alias.`
        },
        {
            type: "error",
            range: [73, 74],
            value: `The identifier cannot be redeclared when it is marked as an alias.`
        }
    ])
})

test("Literals", () => {
    localAnalyze(`
        let a
        let b = null
        let c = 0
        let d = ""
        let e = true
        let f = \`\`
        let g = () => {}
    `)
    checkTopLevelIdentifiers([
        ...["a", "b", "c", "d", "e", "f", "g"].map(name => {
            return {
                name,
                hoist: false,
                implicit: true,
                status: "literal"
            } satisfies ExpectedTopLevelIdentifier
        })
    ])
})

test("Literals will be updated later", () => {
    localAnalyze(`
        let a
        let b = null
        let c = 0
        let d = ""
        let e = true
        let f = \`\`
        let g = () => {}

        a++, --b
        c = undefined
        ;[d, e] = []
        ;({f, g} = {})
    `)
    checkTopLevelIdentifiers([
        ...["a", "b", "c", "d", "e", "f", "g"].map(name => {
            return {
                name,
                hoist: false,
                implicit: true,
                status: "pending"
            } satisfies ExpectedTopLevelIdentifier
        })
    ])
})

test("Shorthand derived declaration is invalid for destructuring declarations", () => {
    localAnalyze(`
        const {$a, $b} = obj
    `)
    checkTopLevelIdentifiers([
        ...["$a", "$b"].map(name => {
            return {
                name,
                hoist: false,
                implicit: true,
                status: "pending"
            } satisfies ExpectedTopLevelIdentifier
        })
    ])
})
