import type { ExpectedCompileMessage, ExpectedTopLevelIdentifier } from "#type-declarations/testing"

import { expect, test } from "vitest"
import { analyzeResult } from "../../../src/compiler/state"
import { objectKeys } from "../../../src/util/shared/aliases"
import { formatSourceCode } from "../../../src/util/testing/sundry"
import { analyzeScript } from "../../../src/compiler/analyzer/script"
import { matchCompileMessages } from "../../../src/util/testing/match"
import { parseTemplateStandalone } from "../../../src/compiler/parser/template"
import { commonMessage as commonWarnMsg } from "../../../src/compiler/message/warn"

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
    let index = 0
    const { topLevelIdentifiers } = analyzeResult.script
    objectKeys(topLevelIdentifiers).forEach(name => {
        const { hoist, status, implicit } = topLevelIdentifiers[name]
        expect({
            name,
            hoist,
            status,
            implicit
        }).toEqual(expected[index++])
    })
}

test("Variable declarations with key: let, const", () => {
    localAnalyze(`
        let a
        let b = reactive()
        let c = shallow()
        let d = derived(()=>{})

        const {e, f: g = h, ...i} = {}
        const [j, k = l, [m = n] = o, ...[p = q, ...r]] = shallow([])
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
        } = reactive()

        if(true){
            var m
            for(var n;;){
                var o = ()=>{
                    var p
                }
            }
        }

        var [q, r = s, ...t] = shallow()
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

test("Typescript enum and module declarations", () => {
    localAnalyze(`
        enum a{}
        const enum b{}

        namespace c{}
        namespace d{
            type e = string
        }
        namespace f{
            const g = 1
        }
        namespace h.i.j{
            export interface k{}
        }
        namespace l.m.n{
            export interface o{}
            export function p(){}
        }
    `)
    checkTopLevelIdentifiers([
        ...["a", "b", "f", "l"].map(name => {
            return {
                name,
                hoist: true,
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

test("Redeclarations", () => {
    const unnecessaryMutableDerivedMsg = commonWarnMsg.UnnecessaryMutableDerivedDeclaration[1]()

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
            range: [70, 71],
            value: unnecessaryMutableDerivedMsg
        },
        {
            type: "error",
            range: [94, 95],
            value: `The derived reactive value "c" cannot be redeclared.`
        },
        {
            type: "error",
            range: [138, 139],
            value: `The derived reactive value "e" cannot be redeclared.`
        },
        {
            type: "warning",
            range: [164, 165],
            value: unnecessaryMutableDerivedMsg
        },
        {
            type: "error",
            range: [183, 184],
            value: `The derived reactive value "f" cannot be redeclared.`
        },
        {
            type: "warning",
            range: [203, 205],
            value: unnecessaryMutableDerivedMsg
        },
        {
            type: "error",
            range: [219, 221],
            value: `The derived reactive value "$g" cannot be redeclared.`
        }
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
