import type { ExpectedCompileMessage } from "#type-declarations/testing"

import { describe, test } from "vitest"
import { formatSourceCode } from "../../../src/util/testing/sundry"
import { analyzeScript } from "../../../src/compiler/analyzer/script"
import { matchCompileMessages } from "../../../src/util/testing/match"
import { parseTemplateStandalone } from "../../../src/compiler/parser/template"
import { commonMessage as commonWarnMsg } from "../../../src/compiler/message/warn"
import { commonMessage as commonErrorMsg } from "../../../src/compiler/message/error"

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

describe("Invalid usages of intrinsic methods", () => {
    const getMsg = commonErrorMsg.InvalidUsageForIntrinsicMethods[1]
    const invalidArgMsg = commonErrorMsg.InvalidParameterForAliasIntrinsic[1]()

    test("Not in the top level", () => {
        localAnalyze(`
            {
                defaultProps()
                defaultRefs()
                reactive()
                shallow()
                raw()
                derived()
                alias()
            }
        `)
        localMatchCompileMessages([
            {
                type: "error",
                range: [6, 18],
                value: getMsg("defaultProps")
            },
            {
                type: "error",
                range: [25, 36],
                value: getMsg("defaultRefs")
            },
            {
                type: "error",
                range: [43, 51],
                value: getMsg("reactive")
            },
            {
                type: "error",
                range: [58, 65],
                value: getMsg("shallow")
            },
            {
                type: "error",
                range: [72, 75],
                value: getMsg("raw")
            },
            {
                type: "error",
                range: [82, 89],
                value: getMsg("derived")
            },
            {
                type: "error",
                range: [96, 103],
                value: invalidArgMsg
            },
            {
                type: "error",
                range: [96, 101],
                value: getMsg("alias")
            }
        ])
    })

    test("Not standalone calls", () => {
        localAnalyze(`
            const a = defaultProps
            true ? defaultRefs() : null

            if(condition){
                defaultProps()
            }
        `)
        localMatchCompileMessages([
            {
                type: "error",
                range: [10, 22],
                value: getMsg("defaultProps")
            },
            {
                type: "error",
                range: [30, 41],
                value: getMsg("defaultRefs")
            },
            {
                type: "error",
                range: [71, 83],
                value: getMsg("defaultProps")
            }
        ])
    })

    test("Not be used to mark variable initializer", () => {
        localAnalyze(`
            const a = reactive
            shallow()
            test(raw(1))
            derived && derived(()=>{})
            alias(a.b)
        `)
        localMatchCompileMessages([
            {
                type: "error",
                range: [10, 18],
                value: getMsg("reactive")
            },
            {
                type: "error",
                range: [19, 26],
                value: getMsg("shallow")
            },
            {
                type: "error",
                range: [34, 37],
                value: getMsg("raw")
            },
            {
                type: "error",
                range: [42, 49],
                value: getMsg("derived")
            },
            {
                type: "error",
                range: [53, 60],
                value: getMsg("derived")
            },
            {
                type: "error",
                range: [69, 74],
                value: getMsg("alias")
            }
        ])
    })

    test("Not be used as a function call", () => {
        localAnalyze(`
            watch
            condition ? preWatch : postWatch
            if(syncWatch){}

            const handler = watch()
            test(condition ? preWatch() : postWatch())
            if(syncWatch()){}
        `)
        localMatchCompileMessages([
            {
                type: "error",
                range: [0, 5],
                value: getMsg("watch")
            },
            {
                type: "error",
                range: [18, 26],
                value: getMsg("preWatch")
            },
            {
                type: "error",
                range: [29, 38],
                value: getMsg("postWatch")
            },
            {
                type: "error",
                range: [42, 51],
                value: getMsg("syncWatch")
            }
        ])
    })

    test("Argument is not left value", () => {
        localAnalyze(`
            let a = alias(1)
            let { b } = alias({})
            const [c, d] = alias(getObj(), a++)
            const { e, f: { g } } = alias(h.i, j.k)
        `)
        localMatchCompileMessages([
            {
                type: "error",
                range: [8, 16],
                value: invalidArgMsg
            },
            {
                type: "error",
                range: [29, 38],
                value: invalidArgMsg
            },
            {
                type: "error",
                range: [54, 74],
                value: invalidArgMsg
            },
            {
                type: "error",
                range: [99, 114],
                value: invalidArgMsg
            }
        ])
    })

    test("Destructuring alias binding can not specific default values", () => {
        localAnalyze(`
            var { a = b } = alias(_._)
            let {
                c: {
                    d: { e = f }
                }
            } = alias(_._)
            const [g = h] = alias(_._),
                [i, [j, [k = l]]] = alias(_._)
        `)
        localMatchCompileMessages([
            {
                type: "error",
                range: [4, 26],
                value: `Invalid alias destructuring declaration: default values are not allowed in destructuring bindings of alias declarations.`
            },
            {
                type: "error",
                range: [31, 83],
                value: `Invalid alias destructuring declaration: default values are not allowed in destructuring bindings of alias declarations.`
            },
            {
                type: "error",
                range: [90, 110],
                value: `Invalid alias destructuring declaration: default values are not allowed in destructuring bindings of alias declarations.`
            },
            {
                type: "error",
                range: [116, 146],
                value: `Invalid alias destructuring declaration: default values are not allowed in destructuring bindings of alias declarations.`
            }
        ])
    })

    test("Valid calls", () => {
        localAnalyze(`
            const a = shallow!(_)
            const b = (reactive as any)(_)
            const c = (raw satisfies any)(_)
        `)
        localMatchCompileMessages([])
    })
})

describe("Unnecessary reactive marking", () => {
    const getMsg = commonWarnMsg.UnnecessaryReactiveMark[1]

    test("Const declarations with literals", () => {
        localAnalyze(`
            const a = reactive(1)
            const b = shallow(1)
            const c = reactive("")
            const d = shallow()
            const e = reactive(null)
            const f = shallow(null)
            const g = raw(\`\`)
        `)
        localMatchCompileMessages([
            {
                type: "warning",
                range: [10, 21],
                value: getMsg("reactive")
            },
            {
                type: "warning",
                range: [32, 42],
                value: getMsg("shallow")
            },
            {
                type: "warning",
                range: [53, 65],
                value: getMsg("reactive")
            },
            {
                type: "warning",
                range: [76, 85],
                value: getMsg("shallow")
            },
            {
                type: "warning",
                range: [96, 110],
                value: getMsg("reactive")
            },
            {
                type: "warning",
                range: [121, 134],
                value: getMsg("shallow")
            },
            {
                type: "warning",
                range: [145, 152],
                value: commonWarnMsg.RedundantRawMark[1]()
            }
        ])
    })

    test("Derived with literals", () => {
        localAnalyze(`
                const a = derived()
                const b = derived(1)
                const c = derived("")
                const d = derived(null)
                const e = derived(undefined)
            `)
        localMatchCompileMessages([
            {
                type: "warning",
                range: [10, 19],
                value: getMsg("derived")
            },
            {
                type: "warning",
                range: [30, 40],
                value: getMsg("derived")
            },
            {
                type: "warning",
                range: [51, 62],
                value: getMsg("derived")
            },
            {
                type: "warning",
                range: [73, 86],
                value: getMsg("derived")
            },
            {
                type: "warning",
                range: [97, 115],
                value: getMsg("derived")
            }
        ])
    })

    test("Shorthand derived", () => {
        localAnalyze(`
                const $a = 1
                const $b = ""
                const $c = null
                const $d = undefined
            `)
        localMatchCompileMessages([
            {
                type: "warning",
                range: [6, 12],
                value: getMsg("derived")
            },
            {
                type: "warning",
                range: [19, 26],
                value: getMsg("derived")
            },
            {
                type: "warning",
                range: [33, 42],
                value: getMsg("derived")
            },
            {
                type: "warning",
                range: [49, 63],
                value: getMsg("derived")
            }
        ])
    })
})

test("Shadow compiler intrinsic identifiers", () => {
    const getMsg = commonErrorMsg.ShadowCompilerIntrinsicAtTopLevel[1]
    localAnalyze(`
                if(true){
                    const props = 1
                    const refs = 2
                    const reactive = 3
                }

                const props = 1
                const refs = 2
                const slots = 3
                const reactive = 4
                let shallow =5
                var raw = 6
                using derived = 7
                const defaultProps = 8
                enum defaultRefs {}
                import watch from ""
                import { postWatch } from ""
                import { ___ as syncWatch } from ""
            `)
    localMatchCompileMessages([
        {
            type: "error",
            range: [81, 86],
            value: getMsg("props")
        },
        {
            type: "error",
            range: [97, 101],
            value: getMsg("refs")
        },
        {
            type: "error",
            range: [112, 117],
            value: getMsg("slots")
        },
        {
            type: "error",
            range: [128, 136],
            value: getMsg("reactive")
        },
        {
            type: "error",
            range: [145, 152],
            value: getMsg("shallow")
        },
        {
            type: "error",
            range: [160, 163],
            value: getMsg("raw")
        },
        {
            type: "error",
            range: [174, 181],
            value: getMsg("derived")
        },
        {
            type: "error",
            range: [192, 204],
            value: getMsg("defaultProps")
        },
        {
            type: "error",
            range: [214, 225],
            value: getMsg("defaultRefs")
        },
        {
            type: "error",
            range: [236, 241],
            value: getMsg("watch")
        },
        {
            type: "error",
            range: [259, 268],
            value: getMsg("postWatch")
        },
        {
            type: "error",
            range: [295, 304],
            value: getMsg("syncWatch")
        }
    ])
})

test("Shorthand derived declaration with compiler intrinsic method", () => {
    localAnalyze(`
        const $a = derived(() => {})
        let $b = reactive()
        const $c = raw(1)
    `)
    localMatchCompileMessages([
        {
            type: "warning",
            range: [6, 28],
            value: commonWarnMsg.DeclareDerivedMixedSyntaticForms[1]()
        },
        {
            type: "error",
            range: [33, 48],
            value: commonErrorMsg.AmbiguousReactiveMarking[1]("reactive")
        },
        {
            type: "warning",
            range: [33, 48],
            value: commonWarnMsg.UnnecessaryMutableDerivedDeclaration[1]()
        },
        {
            type: "error",
            range: [55, 66],
            value: commonErrorMsg.AmbiguousReactiveMarking[1]("raw")
        }
    ])
})

test("Duplicate default definitions", () => {
    localAnalyze(`
        defaultProps({})
        defaultProps({})

        defaultRefs({})
        defaultRefs({})
        defaultRefs({})
    `)
    localMatchCompileMessages([
        {
            type: "warning",
            range: [0, 12],
            value: `This default value definition for "props" is ignored because it is overridden by a later one.`
        },
        {
            type: "warning",
            range: [35, 46],
            value: `This default value definition for "refs" is ignored because it is overridden by a later one.`
        },
        {
            type: "warning",
            range: [51, 62],
            value: `This default value definition for "refs" is ignored because it is overridden by a later one.`
        }
    ])
})
