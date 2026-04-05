import { describe, it } from "vitest"
import { formatSourceCode } from "../../../../src/util/shared/sundry"
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
        it("should wrap the argument as a getter", () => {
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

                    const $a = _.derived(() => (obj))
                    const $b = _.derived(() => (count + 1))
                    const $c = _.derived(() => (outter?.inner))
                    console.log($a.$, $b.$, $c.$)
                `)
            )
        })

        it("should not warp the argument as a getter", () => {
            matchTransformedScript(
                `
                    <lang-ts>
                        console.log($a, $b, $c)

                        const $a = (() => obj as any) as any
                        const $b = function<T>(count: T): T {
                            return count + 1
                        }
                        let $c = function anonymous() {
                            return outter?.inner
                        }
                        console.log($a, $b, $c)
                    </lang-ts>
                `,
                formatSourceCode(`
                    console.log($a, $b, $c)

                    const $a = _.derived((() => obj as any) as any)
                    const $b = _.derived(function<T>(count: T): T {
                        return count + 1
                    })
                    let $c = _.derived(function anonymous() {
                        return outter?.inner
                    })
                    console.log($a.$, $b.$, $c.$)
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
        it("should wrap the argument as a getter", () => {
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
                    const _S1 = v => ($a = v)
                    const _S2 = v => ($b = v)
                    const _S3 = v => ($c = v)
                    console.log($a, $b, $c)

                    let [_$a, $a] = _.derived(() => (obj), _S1)
                    let [_$b, $b] = _.derived(() => (count + 1), _S2)
                    let [_$c, $c] = _.derived(() => (outter?.inner), _S3)
                    console.log(_$a.$, _$b.$, _$c.$)
                `)
            )
        })

        it("should not warp the argument as a getter", () => {
            matchTransformedScript(
                `
                    <lang-ts>
                        console.log($a, $b, $c)

                        const $a = (() => obj as any) as any
                        const $b = function<T>(count: T): T {
                            return count + 1
                        }
                        let $c = function anonymous() {
                            return outter?.inner
                        }
                        console.log($a, $b, $c)
                    </lang-ts>
                `,
                formatSourceCode(`
                    const _S1 = v => ($a = v)
                    const _S2 = v => ($b = v)
                    const _S3 = v => ($c = v)
                    console.log($a, $b, $c)

                    let [_$a, $a] = _.derived((() => obj as any) as any, _S1)
                    let [_$b, $b] = _.derived(function<T>(count: T): T {
                        return count + 1
                    }, _S2)
                    let [_$c, $c] = _.derived(function anonymous() {
                        return outter?.inner
                    }, _S3)
                    console.log(_$a.$, _$b.$, _$c.$)
                `)
            )
        })
    })
})

it("sbould not be transfomed as derived reactive value when shorthandDerivedDeclaration is false", () => {
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
                debug: !!i,
                shorthandDerivedDeclaration: false
            }
        )
    }
})
