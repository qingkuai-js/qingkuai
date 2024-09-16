import type { Replacement, ReplacementItem } from "../../compiler/types"

import { warnSpy } from "../vi"
import { test, expect, describe } from "vitest"
import { setArrLength } from "../../util/runtime"
import { isFunction, isNumber } from "../../util/shared"
import { analyzeScript } from "../../compiler/analyzer/script"
import { eliminateRanges, replacement as _replacement } from "../../compiler/state"

let justReturnRawValue = false
const replacement = new Proxy<any>(_replacement, {
    get(target, property) {
        if (!isFunction(target[property])) {
            return target[property]
        }
        return (...args: any) => {
            const ret = target[property](...args)
            if (property !== "get" || !ret || justReturnRawValue) {
                return ret
            }
            return new Proxy(ret, {
                get(t, p) {
                    if (p === "items") {
                        t[p].forEach((item: ReplacementItem) => {
                            if (isFunction(item.text)) {
                                item.text = item.text()
                            }
                        })
                        return t[p]
                    }
                    return t[p]
                }
            })
        }
    }
})

const reset = () => {
    replacement.clear()
    replacement.set("", {
        useDollar: false,
        status: "stc",
        items: []
    })
    warnSpy.mockClear()
    justReturnRawValue = false
    setArrLength(eliminateRanges, 0)
}

const reaWarnMsg =
    "rea accepts a maximum of 2 parameters, and the excess parameters has been ignored."
const watchWarnMsg = (fnName: string, need: string | number) => {
    let needMsg = "requires only one parameter"
    if (!isNumber(need) || need > 1) {
        needMsg = `accepts a maximum of ${need} parameters`
    }
    return `${fnName} ${needMsg}, and the excess parameters has been ignored.`
}

const watchInvalidArgMsg = (fnName: string) =>
    `The first argument for watcher related compiler helper function(${fnName}) is invalid, it should be a static Identifier or MemberExpression.`

const stcWarnMsg = "stc requires only one parameter, and the excess parameters has been ignored."
const derWranMsg = "der requires only one parameter, and the excess parameters has been ignored."
const derWDWranMsg = "Destructure the return value of der will result in a loss of reacativity."

describe("The normal call of compiler helper functions", () => {
    test("find and analysis [ stc ] function", () => {
        analyzeScript("let a = stc()")
        expect(replacement.has("a")).toBe(true)
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 13,
                    text: "void 0",
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([[8, 13]])
        reset()

        analyzeScript("let a =stc(10)")
        expect(replacement.has("a")).toBe(false)
        expect(eliminateRanges).toEqual([
            [7, 11],
            [13, 14]
        ])
        reset()

        analyzeScript("const a = stc(10,  20);")
        expect(replacement.has("a")).toBe(false)
        expect(eliminateRanges).toEqual([
            [10, 14],
            [16, 22]
        ])
        expect(warnSpy).toBeCalledWith(stcWarnMsg)
        reset()

        analyzeScript(`const a =  stc({v: " "}, 20, 30, 40) ;`)
        expect(replacement.has("a")).toBe(false)
        expect(eliminateRanges).toEqual([
            [11, 15],
            [23, 36]
        ])
        expect(warnSpy).toBeCalledWith(stcWarnMsg)
        reset()
    })

    test("find and analysis [ rea ] function", () => {
        analyzeScript("let a")
        expect(eliminateRanges.length).toBe(0)
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 5,
                    processed: false,
                    text: " = reactivity()"
                }
            ]
        })
        reset()

        analyzeScript("let a =rea () ")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 13,
                    processed: false,
                    text: "reactivity()"
                }
            ]
        })
        expect(eliminateRanges).toEqual([[7, 13]])
        reset()

        analyzeScript("let a = rea( 10 )")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 13,
                    processed: false,
                    text: "reactivity("
                }
            ]
        })
        expect(eliminateRanges).toEqual([[8, 13]])
        reset()

        analyzeScript("let a = rea   (10,  ) ")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 15,
                    processed: false,
                    text: "reactivity("
                }
            ]
        })
        expect(eliminateRanges).toEqual([[8, 15]])
        reset()

        analyzeScript("let a=rea(10,20 )")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 10,
                    processed: false,
                    text: "reactivity("
                }
            ]
        })
        expect(eliminateRanges).toEqual([[6, 10]])
        reset()

        analyzeScript("let a = rea(10,20 , 30)")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 12,
                    processed: false,
                    text: "reactivity("
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [8, 12],
            [17, 22]
        ])
        expect(warnSpy).toBeCalledWith(reaWarnMsg)
        reset()

        analyzeScript("let a = rea(10,20 , )")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 12,
                    processed: false,
                    text: "reactivity("
                }
            ]
        })
        expect(eliminateRanges).toEqual([[8, 12]])
        reset()

        analyzeScript("const a =10")
        expect(eliminateRanges.length).toBe(0)
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "pending",
            useDollar: false,
            items: [
                {
                    index: 9,
                    processed: false,
                    text: "constReactivity("
                },
                {
                    index: 11,
                    text: ")",
                    processed: false
                }
            ]
        })
        reset()

        analyzeScript("const a   =   rea()")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 19,
                    processed: false,
                    text: "constReactivity()"
                }
            ]
        })
        expect(eliminateRanges).toEqual([[14, 19]])
        reset()

        analyzeScript("const a=rea({v})")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 12,
                    processed: false,
                    text: "constReactivity("
                }
            ]
        })
        expect(eliminateRanges).toEqual([[8, 12]])
        reset()

        analyzeScript("const a  =  rea ({   v }, )")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 17,
                    processed: false,
                    text: "constReactivity("
                }
            ]
        })
        expect(eliminateRanges).toEqual([[12, 17]])
        reset()

        analyzeScript("const a = rea(10,20)")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 14,
                    processed: false,
                    text: "constReactivity("
                }
            ]
        })
        expect(eliminateRanges).toEqual([[10, 14]])
        reset()

        analyzeScript("const a=rea(10,20,30)")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 12,
                    processed: false,
                    text: "constReactivity("
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [8, 12],
            [17, 20]
        ])
        expect(warnSpy).toBeCalledWith(reaWarnMsg)
        reset()

        analyzeScript("const a=rea(10,20,30,40,50)")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 12,
                    processed: false,
                    text: "constReactivity("
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [8, 12],
            [17, 26]
        ])
        expect(warnSpy).toBeCalledWith(reaWarnMsg)

        reset()
    })

    test("find and analysis [ der ] function", () => {
        analyzeScript("let v = der( )")
        expect(replacement.get("v")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 14,
                    processed: false,
                    text: "derived(_ => (void 0))"
                }
            ]
        })
        expect(eliminateRanges).toEqual([[8, 14]])
        reset()

        expect(analyzeScript("let v = der( a  * 2)"))
        expect(replacement.get("v")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 13,
                    processed: false,
                    text: "derived(_ => ("
                },
                {
                    index: 20,
                    text: ")",
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([[8, 13]])
        reset()

        expect(analyzeScript("const v = der( ()   => obj.a + 1 )"))
        expect(replacement.get("v")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 15,
                    processed: false,
                    text: "derived("
                }
            ]
        })
        expect(eliminateRanges).toEqual([[10, 15]])
        reset()

        expect(analyzeScript(" const v  = der (  function (){ return JSON.stringify(obj) } , 10)"))
        expect(replacement.get("v")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 19,
                    processed: false,
                    text: "derived("
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [12, 19],
            [60, 65]
        ])
        expect(warnSpy).toBeCalledWith(derWranMsg)

        reset()

        expect(
            analyzeScript("const v = der(function anonymous(p, ...rest){\n\treturn rest\n}, ``)")
        )
        expect(replacement.get("v")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 14,
                    processed: false,
                    text: "derived("
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [10, 14],
            [60, 64]
        ])
        expect(warnSpy).toBeCalledWith(derWranMsg)

        reset()
    })

    test("find and analysis [ wat Wat waT ] functions", () => {
        expect(() => analyzeScript("const unwatch = wat()")).toThrowError(watchInvalidArgMsg("wat"))

        expect(() => analyzeScript("const unwatch = wat(1)")).toThrowError(
            watchInvalidArgMsg("wat")
        )

        expect(() => analyzeScript("const unwatch = wat(()=>{})")).toThrowError(
            watchInvalidArgMsg("wat")
        )

        expect(() => analyzeScript("const unwatch = wat({})")).toThrowError(
            watchInvalidArgMsg("wat")
        )

        expect(() => analyzeScript("const unwatch = Wat()")).toThrowError(watchInvalidArgMsg("Wat"))

        expect(() => analyzeScript("const unwatch = waT(a)")).toThrowError(
            watchInvalidArgMsg("waT")
        )

        expect(() =>
            analyzeScript(
                "const a = 10; const unwatch = wat(a, (pre, cur)=>{ console.log(pre, cur) })"
            )
        ).toThrowError(watchInvalidArgMsg("wat"))
        reset()

        analyzeScript("let a = 10; const unwatch = wat(a, (pre, cur)=>{ console.log(pre, cur) })")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 8,
                    processed: false,
                    text: "reactivity("
                },
                {
                    index: 10,
                    text: ")",
                    processed: false
                }
            ]
        })
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 32,
                    text: "watch(",
                    processed: false
                },
                {
                    index: 33,
                    processed: false,
                    text: `, "$", "sync"`
                }
            ]
        })
        expect(eliminateRanges).toEqual([[28, 32]])
        reset()

        analyzeScript("let a; const unwatch = wat(a, 'pre', (pre,cur)=>{})")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 5,
                    processed: false,
                    text: " = reactivity()"
                }
            ]
        })
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 27,
                    text: "watch(",
                    processed: false
                },
                {
                    index: 28,
                    text: ', "$"',
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([[23, 27]])
        reset()

        analyzeScript("let a; const unwatch = wat(a, 'pre', 1, (pre,cur)=>{}   )")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 5,
                    processed: false,
                    text: " = reactivity()"
                }
            ]
        })
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 27,
                    text: "watch(",
                    processed: false
                },
                {
                    index: 28,
                    text: `, "$"`,
                    processed: false
                }
            ]
        })
        expect(warnSpy).toBeCalledWith(watchWarnMsg("wat", "2-3"))
        expect(eliminateRanges).toEqual([
            [23, 27],
            [38, 56]
        ])

        reset()

        analyzeScript("let a; const unwatch = Wat(a, (pre,cur)=>{}   )")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 5,
                    processed: false,
                    text: " = reactivity()"
                }
            ]
        })
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 27,
                    text: "watch(",
                    processed: false
                },
                {
                    index: 28,
                    text: `, "$", "pre"`,
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([[23, 27]])
        reset()

        analyzeScript("let a; const unwatch = Wat(a, (pre,cur)=>{}   ,1)")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 5,
                    processed: false,
                    text: " = reactivity()"
                }
            ]
        })
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 27,
                    text: "watch(",
                    processed: false
                },
                {
                    index: 28,
                    text: `, "$", "pre"`,
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [23, 27],
            [43, 48]
        ])
        expect(warnSpy).toBeCalledWith(watchWarnMsg("Wat", 2))

        reset()

        analyzeScript("let a; const unwatch = waT(a, (pre,cur)=>{}   ,1)")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 5,
                    processed: false,
                    text: " = reactivity()"
                }
            ]
        })
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 27,
                    text: "watch(",
                    processed: false
                },
                {
                    index: 28,
                    text: `, "$", "post"`,
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [23, 27],
            [43, 48]
        ])
        expect(warnSpy).toBeCalledWith(watchWarnMsg("waT", 2))

        reset()

        analyzeScript("let a; const unwatch = wat(a.b.c,(pre,cur)=>{})")
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 5,
                    processed: false,
                    text: " = reactivity()"
                },
                {
                    index: 28,
                    text: ".$",
                    processed: false
                }
            ]
        })
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 27,
                    text: "watch(",
                    processed: false
                },
                {
                    index: 30,
                    text: `, "`,
                    processed: false
                },
                {
                    index: 32,
                    text: `", "sync"`,
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [23, 27],
            [30, 31]
        ])
        reset()

        analyzeScript("let a; const unwatch = Wat(a.b[c], ()=>{})")
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 27,
                    text: "watch(",
                    processed: false
                },
                {
                    index: 30,
                    text: `, `,
                    processed: false
                },
                {
                    index: 32,
                    text: `, "pre"`,
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [23, 27],
            [30, 31],
            [32, 33]
        ])
        reset()

        analyzeScript("let a; const unwatch = waT(a?.b?.[c], void 0,1)")
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 27,
                    text: "watch(",
                    processed: false
                },
                {
                    index: 31,
                    text: ", ",
                    processed: false
                },
                {
                    index: 35,
                    text: `, "post"`,
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [23, 27],
            [31, 34],
            [35, 36],
            [44, 46]
        ])
        reset()
    })

    test.only("find and analysis [ eff Eff efF ] functions", () => {
        expect(() => analyzeScript("const uneffect = Eff(  )")).toThrowError(
            /at least one argument to call Eff/
        )
        reset()

        analyzeScript("const uneffect = eff( ()=>{})")
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 22,
                    processed: false,
                    text: `effect("sync", `
                }
            ]
        })
        expect(eliminateRanges).toEqual([[17, 22]])
        reset()

        analyzeScript("const uneffect = eff (  'pre', noop)")
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 24,
                    text: "effect(",
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([[17, 24]])
        reset()

        analyzeScript("const uneffect = eff (  'pre', noop    , noop)")
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 24,
                    text: "effect(",
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [17, 24],
            [35, 45]
        ])
        expect(warnSpy).toBeCalledTimes(1)
        expect(warnSpy).toBeCalledWith(watchWarnMsg("eff", "1-2"))
        reset()

        analyzeScript("const uneffect = Eff (  noop, 'pre')")
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 24,
                    text: `effect("pre", `,
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [17, 24],
            [28, 35]
        ])
        expect(warnSpy).toBeCalledTimes(1)
        expect(warnSpy).toBeCalledWith(watchWarnMsg("Eff", 1))
        reset()

        analyzeScript("const uneffect = efF (  noop,   'pre')")
        expect(replacement.get("")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 24,
                    text: `effect("post", `,
                    processed: false
                }
            ]
        })
        expect(eliminateRanges).toEqual([
            [17, 24],
            [28, 37]
        ])
        expect(warnSpy).toBeCalledTimes(1)
        expect(warnSpy).toBeCalledWith(watchWarnMsg("efF", 1))
        reset()
    })

    test("find and analysis derived reactive state created by variable declaration that starts with $", () => {
        analyzeScript("const $v = a * 10")
        expect(replacement.get("$v")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 11,
                    processed: false,
                    text: "derived(_ => ("
                },
                {
                    index: 17,
                    text: "))",
                    processed: false
                }
            ]
        })
        expect(eliminateRanges.length).toBe(0)
        reset()

        analyzeScript("let $v")
        expect(replacement.get("$v")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 6,
                    processed: false,
                    text: " = derived(_ => (void 0))"
                }
            ]
        })
        expect(eliminateRanges.length).toBe(0)
        reset()

        analyzeScript("let $v = () =>  a * 20")
        expect(replacement.get("$v")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 9,
                    processed: false,
                    text: "derived("
                },
                {
                    index: 22,
                    text: ")",
                    processed: false
                }
            ]
        })
        expect(eliminateRanges.length).toBe(0)
        reset()

        analyzeScript("let $v = function (){ return JSON.stringify(obj) }")
        expect(replacement.get("$v")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 9,
                    processed: false,
                    text: "derived("
                },
                {
                    index: 50,
                    text: ")",
                    processed: false
                }
            ]
        })
        expect(eliminateRanges.length).toBe(0)
        reset()
    })
})

describe("The call of compiler helper functions with destructuring sytax", () => {
    test("find and analysis [ stc ] with destructuring syntax", () => {
        analyzeScript("let {a} = stc(' ')")
        expect(replacement.size).toBe(1)
        expect(eliminateRanges).toEqual([
            [10, 14],
            [17, 18]
        ])
        reset()

        analyzeScript("let {a,b,c:d,d:[e]}=stc()")
        expect(replacement.has("a")).toBe(true)
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "stc",
            useDollar: false,
            items: [
                {
                    index: 25,
                    text: "void 0",
                    processed: false
                }
            ]
        })
        justReturnRawValue = true
        expect(eliminateRanges).toEqual([[20, 25]])
        expect(replacement.get("a")).toBe(replacement.get("b"))
        expect(replacement.get("b")).toBe(replacement.get("d"))
        expect(replacement.get("d")).toBe(replacement.get("e"))
        reset()

        analyzeScript("let [a,b]=stc(10,20)")
        expect(eliminateRanges).toEqual([
            [10, 14],
            [16, 20]
        ])
        justReturnRawValue = true
        expect(replacement.has("a")).toBe(false)
        expect(replacement.has("b")).toBe(false)
        expect(warnSpy).toBeCalledWith(stcWarnMsg)

        reset()

        justReturnRawValue = true
        analyzeScript("const {a,b:[c]} = stc()")
        expect(replacement.has("a")).toBe(true)
        expect(eliminateRanges).toEqual([[18, 23]])
        expect(replacement.get("a")).toBe(replacement.get("c"))
        reset()

        analyzeScript("const [a,d] = stc(10,   20,    30)")
        expect(eliminateRanges).toEqual([
            [14, 18],
            [20, 34]
        ])
        justReturnRawValue = true
        expect(replacement.has("a")).toBe(false)
        expect(replacement.has("d")).toBe(false)
        expect(warnSpy).toBeCalledWith(stcWarnMsg)

        reset()

        analyzeScript("const [a=10, ...b] = stc({},c)")
        expect(eliminateRanges).toEqual([
            [21, 25],
            [27, 30]
        ])
        justReturnRawValue = true
        expect(replacement.has("a")).toBe(false)
        expect(replacement.has("b")).toBe(false)
        reset()
    })

    test("find and analysis [ rea ] with destructuring syntax", () => {
        expect(() => analyzeScript("let {a, b:c, c: [d,e]}")).toThrowError("initialization value")

        analyzeScript("let {a,b} = rea()")
        expect(replacement.has("a")).toBe(true)
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 17,
                    processed: false,
                    text: "reactivity()?.$"
                }
            ]
        })
        justReturnRawValue = true
        expect(eliminateRanges).toEqual([[12, 17]])
        expect(replacement.get("a")).toBe(replacement.get("b"))
        reset()

        analyzeScript("let [a = 10, [b , ...c]] = rea({}, 1)")
        expect(replacement.has("a")).toBe(true)
        expect(eliminateRanges).toEqual([[27, 31]])
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 31,
                    processed: false,
                    text: "reactivity("
                },
                {
                    index: 37,
                    text: "?.$",
                    processed: false
                }
            ]
        })
        justReturnRawValue = true
        expect(replacement.get("a")).toBe(replacement.get("b"))
        expect(replacement.get("b")).toBe(replacement.get("c"))
        reset()

        analyzeScript("let {a:b = 10, ...c} = rea(10,20,30) ")
        expect(replacement.has("b")).toBe(true)
        expect(replacement.has("a")).toBe(false)
        expect(warnSpy).toBeCalledWith(reaWarnMsg)
        expect(eliminateRanges).toEqual([
            [23, 27],
            [32, 35]
        ])
        expect(replacement.get("b")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 27,
                    processed: false,
                    text: "reactivity("
                },
                {
                    index: 36,
                    text: "?.$",
                    processed: false
                }
            ]
        })
        justReturnRawValue = true
        expect(replacement.get("b")).toBe(replacement.get("c"))

        reset()

        analyzeScript("const [a = b, ...b] = rea()")
        expect(replacement.has("a")).toBe(true)
        expect(eliminateRanges).toEqual([[22, 27]])
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 27,
                    processed: false,
                    text: "constReactivity()?.$"
                }
            ]
        })
        justReturnRawValue = true
        expect(replacement.get("a")).toBe(replacement.get("b"))
        reset()

        analyzeScript("const {a: b = null, ...c} = rea(10,20, 30, 40)")
        expect(replacement.has("b")).toBe(true)
        expect(replacement.has("a")).toBe(false)
        expect(eliminateRanges).toEqual([
            [28, 32],
            [37, 45]
        ])
        expect(replacement.get("b")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 32,
                    processed: false,
                    text: "constReactivity("
                },
                {
                    index: 46,
                    text: "?.$",
                    processed: false
                }
            ]
        })
        justReturnRawValue = true
        expect(replacement.get("b")).toBe(replacement.get("c"))
        reset()
    })

    test("find and analysis [ der ] with destructuring syntax", () => {
        expect(analyzeScript(" const {v } = der()"))
        expect(replacement.get("v")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 19,
                    processed: false,
                    text: "derived(_ => (void 0))?.$"
                }
            ]
        })
        expect(eliminateRanges).toEqual([[14, 19]])
        expect(warnSpy).toBeCalledWith(derWDWranMsg)

        reset()

        analyzeScript("const {v, ...rest } = der(a*1 , 20)")
        expect(eliminateRanges).toEqual([
            [22, 26],
            [29, 34]
        ])
        expect(warnSpy).toBeCalledWith(derWDWranMsg)
        expect(warnSpy).toBeCalledWith(derWDWranMsg)
        expect(replacement.get("v")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 26,
                    processed: false,
                    text: "derived(_ => ("
                },
                {
                    index: 35,
                    text: ")?.$",
                    processed: false
                }
            ]
        })
        justReturnRawValue = true
        expect(replacement.get("v")).toBe(replacement.get("rest"))

        reset()

        analyzeScript("let {a, b:c , ...rest} = der(function anonymous(){}, 1,2)")
        expect(eliminateRanges).toEqual([
            [25, 29],
            [51, 56]
        ])
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 29,
                    processed: false,
                    text: "derived("
                },
                {
                    index: 57,
                    text: "?.$",
                    processed: false
                }
            ]
        })
        justReturnRawValue = true
        expect(warnSpy).toBeCalledWith(derWranMsg)
        expect(warnSpy).toBeCalledWith(derWDWranMsg)
        expect(replacement.get("a")).toBe(replacement.get("c"))
        expect(replacement.get("c")).toBe(replacement.get("rest"))

        reset()
    })
})

describe("test replacemetn of [ $ ] character", () => {
    const addDotDollarObjs = (...indexes: number[]) => {
        const ret: ReplacementItem[] = []
        indexes.forEach(index => {
            ret.push({
                index,
                text: ".$",
                processed: false
            })
        })
        return ret
    }

    test("long template 1", () => {
        const source = `
        let a;
        const b = rea(); 
        const {c, d:e, ...f} = rea({});
        let [g, ...h] =   rea({}, 10);
        const i = stc(10)
        a,b,c,d,e,f,g,h,i;
        function anonymous(a, c, d){
            a,b,c,d,e,f,g,h,i;
        }
        const obj = {
            a,
            [b]:c,
            e: f,
            f: [ g, h ]
        }
        {
            let a
            a,b,c,d,e,f,g,h,i;
        }
        class A{
            a(){
                console.log(a,b)
            }
            [c](){
                return d, e, this.f
            }
        }
        a.b[c].d[e?f:g?h:i] = void 0
        a?.b?.[c]?.d?.[e?f:g?h:i]
        `
        analyzeScript(source)
        expect(replacement.has("d")).toBe(false)
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 14,
                    processed: false,
                    text: " = reactivity()"
                },
                ...addDotDollarObjs(156),
                {
                    index: 287,
                    text: ": a.$",
                    processed: false
                },
                ...addDotDollarObjs(492, 598, 635)
            ]
        })
        expect(replacement.get("b")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 39,
                    processed: false,
                    text: "constReactivity()"
                }
            ]
        })
        expect(replacement.get("c")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 77,
                    processed: false,
                    text: "constReactivity("
                },
                {
                    index: 80,
                    text: "?.$",
                    processed: false
                }
            ]
        })
        expect(replacement.get("g")).toEqual<Replacement>({
            status: "rea",
            useDollar: false,
            items: [
                {
                    index: 112,
                    processed: false,
                    text: "reactivity("
                },
                {
                    index: 119,
                    text: "?.$",
                    processed: false
                }
            ]
        })
        justReturnRawValue = true
        expect(eliminateRanges).toEqual([
            [34, 39],
            [73, 77],
            [108, 112],
            [139, 143],
            [145, 146]
        ])
        expect(replacement.get("c")).toBe(replacement.get("e"))
        expect(replacement.get("e")).toBe(replacement.get("f"))
        expect(replacement.get("g")).toBe(replacement.get("h"))
        reset()
    })

    test("long template 2", () => {
        const source = `
        let a,b,c;
        let d,e,f = rea({},10)
        let g = rea("")
        let h = g
        const i = stc(10)
        a,b,c,d,e,f,g,h,i;
        function anonymous(a, c, d){
            a,b,c,d,e,f,g,h,i;
        }
        const obj = {
            a,
            [b]:c,
            e: f,
            f: [ g, h ]
        }
        {
            let a
            a,b,c,d,e,f,g,h,i;
        }
        class A{
            a(){
                console.log(a,b)
            }
            [c](){
                return d, e, this.f
            }
        }
        a.b[c].d[e?f:g?h:i] = void 0
        a?.b?.[c]?.d?.[e?f.a:g?h:i]
        `
        analyzeScript(source)
        expect(replacement.get("a")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 14,
                    processed: false,
                    text: " = reactivity()"
                },
                ...addDotDollarObjs(128),
                {
                    index: 259,
                    text: ": a.$",
                    processed: false
                },
                ...addDotDollarObjs(464, 570, 607)
            ]
        })
        expect(replacement.get("b")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 16,
                    processed: false,
                    text: " = reactivity()"
                },
                ...addDotDollarObjs(130, 198, 275, 375, 466)
            ]
        })
        expect(replacement.get("c")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 18,
                    processed: false,
                    text: " = reactivity()"
                },
                ...addDotDollarObjs(132, 278, 377, 496, 574, 614)
            ]
        })
        expect(replacement.get("d")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 33,
                    processed: false,
                    text: " = reactivity()"
                },
                ...addDotDollarObjs(134, 379, 525)
            ]
        })
        expect(replacement.get("e")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 35,
                    processed: false,
                    text: " = reactivity()"
                },
                ...addDotDollarObjs(136, 204, 381, 528, 579, 622)
            ]
        })
        expect(replacement.get("f")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 44,
                    processed: false,
                    text: "reactivity("
                },
                ...addDotDollarObjs(138, 206, 296, 383, 581, 624)
            ]
        })
        expect(replacement.get("g")).toEqual<Replacement>({
            status: "rea",
            useDollar: true,
            items: [
                {
                    index: 71,
                    processed: false,
                    text: "reactivity("
                },
                ...addDotDollarObjs(92, 140, 208, 316, 385, 583, 628)
            ]
        })
        expect(replacement.get("h")).toEqual<Replacement>({
            status: "pending",
            useDollar: true,
            items: [
                {
                    index: 91,
                    processed: false,
                    text: "reactivity("
                },
                {
                    index: 92,
                    text: ")",
                    processed: false
                },
                ...addDotDollarObjs(142, 210, 319, 387, 585, 630)
            ]
        })
        expect(eliminateRanges).toEqual([
            [40, 44],
            [67, 71],
            [111, 115],
            [117, 118]
        ])
        reset()
    })
})
