import { describe, it } from "vitest"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"
import { matchTransformedScript as _matchTransformedScript } from "./_match"

describe("Production", () => {
    const matchTransformedScript = _matchTransformedScript

    describe("Marking", () => {
        it("should wrap the argument as a getter", () => {
            matchTransformedScript(
                `
                    <lang-ts>
                        console.log(a, b, c)

                        const a = (derivedExp as any)(obj)
                        const b = (derivedExp satisfies any)?.(count++)
                        const c = derivedExp!<number[]>(arr.concat([1, 2, 3]))
                        console.log(a, b, c)
                    </lang-ts>
                `,
                formatSourceCode(`
                    console.log(a, b, c)

                    const a = (_.derived as any)(() => (obj))
                    const b = (_.derived satisfies any)?.(() => (count++))
                    const c = _.derived!<number[]>(() => (arr.concat([1, 2, 3])))
                    console.log(a.$, b.$, c.$)
                `)
            )
        })

        it("should not wrap the argument as a getter", () => {
            matchTransformedScript(
                `
                    <lang-ts>
                        console.log(a, b, c)

                        const a = (derived as any)(() => obj)
                        const b = derived<number>(function () {
                            return count++
                        })
                        const c = (derived satisfies any)!(function anonymous() {
                            return arr.concat([1, 2, 3])
                        })
                        console.log(a, b, c)
                    </lang-ts>
                `,
                formatSourceCode(`
                    console.log(a, b, c)

                    const a = (_.derived as any)(() => obj)
                    const b = _.derived<number>(function () {
                        return count++
                    })
                    const c = (_.derived satisfies any)!(function anonymous() {
                        return arr.concat([1, 2, 3])
                    })
                    console.log(a.$, b.$, c.$)
                `)
            )
        })
    })

    describe("Shorthand", () => {
        it("should not treat identifiers prefixed with $ as derived reactive values", () => {
            matchTransformedScript(
                `
                    <lang-js>
                        console.log($a, $b, $c)

                        const $a = obj
                        const $b = count + 1
                        const $c = outter?.inner
                        console.log($a, $b, $c)
                    </lang-js>
                `,
                formatSourceCode(`
                    console.log($a, $b, $c)

                    const $a = obj
                    const $b = count + 1
                    const $c = outter?.inner
                    console.log($a, $b, $c)
                `)
            )
        })
    })

    describe("Propagation", () => {
        it("should promote mutated sources of template-accessed derivedExp", () => {
            matchTransformedScript(
                `
                    <lang-js>
                        let count = 0
                        function setCount(v) {
                            count = v
                        }
                        const double = derivedExp(count * 2)
                    </lang-js>

                    <p>{ double }</p>
                `,
                formatSourceCode(`
                    let count = _.react(0)
                    function setCount(v) {
                        count.$ = v
                    }
                    const double = _.derived(() => (count.$ * 2))
                `)
            )
        })

        it("should promote mutated sources read inside nested callbacks of derivedExp", () => {
            matchTransformedScript(
                `
                    <lang-js>
                        let count = 0
                        function setCount(v) {
                            count = v
                        }
                        const double = derivedExp([1, 2, 3].filter(i => i < count).length)
                    </lang-js>

                    <p>{ double }</p>
                `,
                formatSourceCode(`
                    let count = _.react(0)
                    function setCount(v) {
                        count.$ = v
                    }
                    const double = _.derived(() => ([1, 2, 3].filter(i => i < count.$).length))
                `)
            )
        })

        it("should promote mutated sources of template-accessed derived getters", () => {
            matchTransformedScript(
                `
                    <lang-js>
                        let count = 0
                        function setCount(v) {
                            count = v
                        }
                        const double = derived(() => {
                            return count * 2
                        })
                    </lang-js>

                    <p>{ double }</p>
                `,
                formatSourceCode(`
                    let count = _.react(0)
                    function setCount(v) {
                        count.$ = v
                    }
                    const double = _.derived(() => {
                        return count.$ * 2
                    })
                `)
            )
        })

        it("should not promote sources when the derived value is not accessed in template", () => {
            matchTransformedScript(
                `
                    <lang-js>
                        let count = 0
                        function setCount(v) {
                            count = v
                        }
                        const double = derivedExp(count * 2)
                    </lang-js>

                    <p>static text</p>
                `,
                formatSourceCode(`
                    let count = 0
                    function setCount(v) {
                        count = v
                    }
                    const double = _.derived(() => (count * 2))
                `)
            )
        })
    })

    describe("Destructuring", () => {
        it("should transform destructuring derived declaration into destructuringDerived", () => {
            matchTransformedScript(
                `
                    <lang-js>
                        let src = { code: 1, msg: "ok" }
                        let list = [1, 2]
                        const { code, msg } = derived(() => src)
                        const [first, second] = derived(() => list)
                        console.log(code, msg, first, second)
                    </lang-js>
                `,
                formatSourceCode(`
                    let src = { code: 1, msg: "ok" }
                    let list = [1, 2]
                    const [code, msg] = _.destructuringDerived(({ code, msg }) => [code, msg], () => src, 2)
                    const [first, second] = _.destructuringDerived(([first, second]) => [first, second], () => list, 2)
                    console.log(code.$, msg.$, first.$, second.$)
                `)
            )
        })
    })
})

describe("Development", () => {
    const matchTransformedScript = (source: string, expected: string) => {
        return _matchTransformedScript(source, expected, {
            debug: true
        })
    }

    describe("Marking", () => {
        it("should wrap the argument as a getter", () => {
            matchTransformedScript(
                `
                    <lang-ts>
                        console.log(a, b, c)

                        const a = (derivedExp as any)(obj)
                        const b = (derivedExp satisfies any)?.(count++)
                        const c = derivedExp!<number[]>(arr.concat([1, 2, 3]))
                        console.log(a, b, c)
                    </lang-ts>
                `,
                formatSourceCode(`
                    const _S1 = v => (a = v)
                    const _S2 = v => (b = v)
                    const _S3 = v => (c = v)
                    console.log(a, b, c)

                    let [_a, a] = (_.derived as any)(() => (obj), _S1)
                    let [_b, b] = (_.derived satisfies any)?.(() => (count++), _S2)
                    let [_c, c] = _.derived!<number[]>(() => (arr.concat([1, 2, 3])), _S3)
                    console.log(_a.$, _b.$, _c.$)
                `)
            )
        })

        it("should not wrap the argument as a getter", () => {
            matchTransformedScript(
                `
                    <lang-ts>
                        console.log(a, b, c)

                        const a = (derived as any)(() => obj)
                        const b = derived<number>(function () {
                            return count++
                        })
                        const c = (derived satisfies any)!(function anonymous() {
                            return arr.concat([1, 2, 3])
                        })
                        console.log(a, b, c)
                    </lang-ts>
                `,
                formatSourceCode(`
                    const _S1 = v => (a = v)
                    const _S2 = v => (b = v)
                    const _S3 = v => (c = v)
                    console.log(a, b, c)

                    let [_a, a] = (_.derived as any)(() => obj, _S1)
                    let [_b, b] = _.derived<number>(function () {
                        return count++
                    }, _S2)
                    let [_c, c] = (_.derived satisfies any)!(function anonymous() {
                        return arr.concat([1, 2, 3])
                    }, _S3)
                    console.log(_a.$, _b.$, _c.$)
                `)
            )
        })
    })

    describe("Shorthand", () => {
        it("should not treat identifiers prefixed with $ as derived reactive values", () => {
            matchTransformedScript(
                `
                    <lang-js>
                        console.log($a, $b, $c)

                        const $a = obj
                        const $b = count + 1
                        const $c = outter?.inner
                        console.log($a, $b, $c)
                    </lang-js>
                `,
                formatSourceCode(`
                    console.log($a, $b, $c)

                    const $a = obj
                    const $b = count + 1
                    const $c = outter?.inner
                    console.log($a, $b, $c)
                `)
            )
        })
    })

    describe("Destructuring", () => {
        it("should transform destructuring derived declaration into destructuringDerived with debug setters", () => {
            matchTransformedScript(
                `
                    <lang-js>
                        let src = { code: 1, msg: "ok" }
                        const { code, msg } = derived(() => src)
                        console.log(code, msg)
                    </lang-js>
                `,
                formatSourceCode(`
                    const _S1 = v => (code = v)
                    const _S2 = v => (msg = v)
                    let src = { code: 1, msg: "ok" }
                    let [[_code, code], [_msg, msg]]= _.destructuringDerived(({ code, msg }) => [code, msg], () => src, 2, [_S1, _S2])
                    console.log(_code.$, _msg.$)
                `)
            )
        })
    })
})

it("should never transform the identifiers prefixed with $ as derived reactive values", () => {
    for (let i = 0; i < 2; i++) {
        _matchTransformedScript(
            `
                <lang-js>
                    const $a = obj
                </lang-js>
            `,
            formatSourceCode(`
                const $a = obj
            `),
            {
                debug: !!i
            }
        )
    }
})
