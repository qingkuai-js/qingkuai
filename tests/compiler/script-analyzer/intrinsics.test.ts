import type { ExpectedCompileMessage } from "#type-declarations/testing"

import { describe, test } from "vitest"
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

describe("Invalid usages of intrinsic methods", () => {
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
                value: `The compiler intrinsic "defaultProps" must be called as a standalone expression at top-level scope.`
            },
            {
                type: "error",
                range: [25, 36],
                value: `The compiler intrinsic "defaultRefs" must be called as a standalone expression at top-level scope.`
            },
            {
                type: "error",
                range: [43, 51],
                value: `The compiler intrinsic "reactive" must be called at top-level scope to mark the variable initializer.`
            },
            {
                type: "error",
                range: [58, 65],
                value: `The compiler intrinsic "shallow" must be called at top-level scope to mark the variable initializer.`
            },
            {
                type: "error",
                range: [72, 75],
                value: `The compiler intrinsic "raw" must be called at top-level scope to mark the variable initializer.`
            },
            {
                type: "error",
                range: [82, 89],
                value: `The compiler intrinsic "derived" must be called at top-level scope to mark the variable initializer.`
            },
            {
                type: "error",
                range: [96, 103],
                value: `The compiler intrinsic "alias" must accept exactly one mutable target(lvalue) as its argument.`
            },
            {
                type: "error",
                range: [96, 101],
                value: `The compiler intrinsic "alias" must be called at top-level scope to mark the variable initializer.`
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
                value: `The compiler intrinsic "defaultProps" must be called as a standalone expression at top-level scope.`
            },
            {
                type: "error",
                range: [30, 41],
                value: `The compiler intrinsic "defaultRefs" must be called as a standalone expression at top-level scope.`
            },
            {
                type: "error",
                range: [71, 83],
                value: `The compiler intrinsic "defaultProps" must be called as a standalone expression at top-level scope.`
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
                value: `The compiler intrinsic "reactive" must be called at top-level scope to mark the variable initializer.`
            },
            {
                type: "error",
                range: [19, 26],
                value: `The compiler intrinsic "shallow" must be called at top-level scope to mark the variable initializer.`
            },
            {
                type: "error",
                range: [34, 37],
                value: `The compiler intrinsic "raw" must be called at top-level scope to mark the variable initializer.`
            },
            {
                type: "error",
                range: [42, 49],
                value: `The compiler intrinsic "derived" must be called at top-level scope to mark the variable initializer.`
            },
            {
                type: "error",
                range: [53, 60],
                value: `The compiler intrinsic "derived" must be called at top-level scope to mark the variable initializer.`
            },
            {
                type: "error",
                range: [69, 74],
                value: `The compiler intrinsic "alias" must be called at top-level scope to mark the variable initializer.`
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
                value: `The compiler intrinsic "watch" can only be used as a function call.`
            },
            {
                type: "error",
                range: [18, 26],
                value: `The compiler intrinsic "preWatch" can only be used as a function call.`
            },
            {
                type: "error",
                range: [29, 38],
                value: `The compiler intrinsic "postWatch" can only be used as a function call.`
            },
            {
                type: "error",
                range: [42, 51],
                value: `The compiler intrinsic "syncWatch" can only be used as a function call.`
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
                value: `The compiler intrinsic "alias" must accept exactly one mutable target(lvalue) as its argument.`
            },
            {
                type: "error",
                range: [29, 38],
                value: `The compiler intrinsic "alias" must accept exactly one mutable target(lvalue) as its argument.`
            },
            {
                type: "error",
                range: [54, 74],
                value: `The compiler intrinsic "alias" must accept exactly one mutable target(lvalue) as its argument.`
            },
            {
                type: "error",
                range: [99, 114],
                value: `The compiler intrinsic "alias" must accept exactly one mutable target(lvalue) as its argument.`
            }
        ])
    })

    test("Default values are not allowed in destructuring pattern of alias declaration", () => {
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
                value: `Default values are not allowed in destructuring pattern of alias declarations.`
            },
            {
                type: "error",
                range: [31, 83],
                value: `Default values are not allowed in destructuring pattern of alias declarations.`
            },
            {
                type: "error",
                range: [90, 110],
                value: `Default values are not allowed in destructuring pattern of alias declarations.`
            },
            {
                type: "error",
                range: [116, 146],
                value: `Default values are not allowed in destructuring pattern of alias declarations.`
            }
        ])
    })

    test("Rest elements are not allowed in destructuring pattern of alias declaration", () => {
        localAnalyze(`
            const { a, ...b } = alias(PROPERTY_TYPES)
            const { c: { d, ...e } } = alias(props)
            const [f, ...g] = alias(arr)
            const [h, [i, [j, ...k]]] = alias(arr)
        `)
        localMatchCompileMessages([
            {
                type: "error",
                range: [6, 41],
                value: `Rest elements are not allowed in destructuring pattern of alias declarations.`
            },
            {
                type: "error",
                range: [48, 81],
                value: `Rest elements are not allowed in destructuring pattern of alias declarations.`
            },
            {
                type: "error",
                range: [88, 110],
                value: `Rest elements are not allowed in destructuring pattern of alias declarations.`
            },
            {
                type: "error",
                range: [117, 149],
                value: `Rest elements are not allowed in destructuring pattern of alias declarations.`
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
                value: `This value will never change, so marking it reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [32, 42],
                value: `This value will never change, so marking it shallow reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [53, 65],
                value: `This value will never change, so marking it reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [76, 85],
                value: `This value will never change, so marking it shallow reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [96, 110],
                value: `This value will never change, so marking it reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [121, 134],
                value: `This value will never change, so marking it shallow reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [145, 152],
                value: `Marking a const with a literal initializer as raw is redundant, as it is treated as raw by default.`
            }
        ])
    })

    test("Derived with literals", () => {
        localAnalyze(`
                const a = derivedExp()
                const b = derivedExp(1)
                const c = derivedExp("")
                const d = derivedExp(null)
                const e = derivedExp(undefined)
            `)
        localMatchCompileMessages([
            {
                type: "warning",
                range: [10, 22],
                value: `This value will never change, so marking it derived reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [33, 46],
                value: `This value will never change, so marking it derived reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [57, 71],
                value: `This value will never change, so marking it derived reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [82, 98],
                value: `This value will never change, so marking it derived reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [109, 130],
                value: `This value will never change, so marking it derived reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
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
                value: `This value will never change, so marking it derived reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [19, 26],
                value: `This value will never change, so marking it derived reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [33, 42],
                value: `This value will never change, so marking it derived reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            },
            {
                type: "warning",
                range: [49, 63],
                value: `This value will never change, so marking it derived reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
            }
        ])
    })
})

test("Shadow compiler intrinsic identifiers", () => {
    localAnalyze(`
                if(true){
                    const props = 1
                    const refs = 2
                    const reactive = 3
                }

                const props = 1
                const refs = 2
                const slots = 3
                let reactive = 4
                var shallow =5
                using raw = 6
                class derived {}
                function defaultProps() {}
                enum defaultRefs {}
                import watch from ""
                import { postWatch } from ""
                import { ___ as syncWatch } from ""
            `)
    localMatchCompileMessages([
        {
            type: "error",
            range: [81, 86],
            value: `Compiler intrinsic identifier "props" cannot be shadowed at top-level scope.`
        },
        {
            type: "error",
            range: [97, 101],
            value: `Compiler intrinsic identifier "refs" cannot be shadowed at top-level scope.`
        },
        {
            type: "error",
            range: [112, 117],
            value: `Compiler intrinsic identifier "slots" cannot be shadowed at top-level scope.`
        },
        {
            type: "error",
            range: [126, 134],
            value: `Compiler intrinsic identifier "reactive" cannot be shadowed at top-level scope.`
        },
        {
            type: "error",
            range: [143, 150],
            value: `Compiler intrinsic identifier "shallow" cannot be shadowed at top-level scope.`
        },
        {
            type: "error",
            range: [160, 163],
            value: `Compiler intrinsic identifier "raw" cannot be shadowed at top-level scope.`
        },
        {
            type: "error",
            range: [174, 181],
            value: `Compiler intrinsic identifier "derived" cannot be shadowed at top-level scope.`
        },
        {
            type: "error",
            range: [194, 206],
            value: `Compiler intrinsic identifier "defaultProps" cannot be shadowed at top-level scope.`
        },
        {
            type: "error",
            range: [217, 228],
            value: `Compiler intrinsic identifier "defaultRefs" cannot be shadowed at top-level scope.`
        },
        {
            type: "error",
            range: [239, 244],
            value: `Compiler intrinsic identifier "watch" cannot be shadowed at top-level scope.`
        },
        {
            type: "error",
            range: [262, 271],
            value: `Compiler intrinsic identifier "postWatch" cannot be shadowed at top-level scope.`
        },
        {
            type: "error",
            range: [298, 307],
            value: `Compiler intrinsic identifier "syncWatch" cannot be shadowed at top-level scope.`
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
            value: `Mixing two syntactic forms to declare derived reactive value is not recommended.`
        },
        {
            type: "error",
            range: [33, 48],
            value: `Using both the shorthand derived value declaration(with the "$" prefix) and a different reactive-marking intrinsic("reactive") method is ambiguous.`
        },
        {
            type: "warning",
            range: [33, 48],
            value: `The derived reactive value is read-only and cannot be explicitly mutated. Declaring it as mutable is unnecessary, consider declaring it with \`const\`.`
        },
        {
            type: "error",
            range: [55, 66],
            value: `Using both the shorthand derived value declaration(with the "$" prefix) and a different reactive-marking intrinsic("raw") method is ambiguous.`
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
