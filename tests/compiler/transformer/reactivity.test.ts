import { test, describe } from "vitest"
import { formatSourceCode } from "../../../src/util/testing/sundry"
import { matchTransformedScript as _matchTransformedScript } from "./_match"

describe("Production", () => {
    const matchTransformedScript = _matchTransformedScript

    describe("Explicit VariableDeclaration", () => {
        describe("Non-destructuring", () => {
            test("var reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            console.log(a, b, c)

                            var a = 0,
                                b = reactive(10),
                                c
                            console.log(a, b, c)
                        </lang-js>
                    `,
                    formatSourceCode(`
                        const _b = _.react(_.UNDEF)
                        console.log(a, _b.$, c)

                        var a = 0,
                            b = 10; _b.$ = b;
                            var c
                        console.log(a, _b.$, c)
                    `)
                )
            })

            test("let reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            console.log(a)

                            let a = reactive(10)
                            console.log(a)
                        </lang-js>
                    `,
                    formatSourceCode(`
                        console.log(a)

                        let a = _.react(10)
                        console.log(a.$)
                    `)
                )
            })

            test("const reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            console.log(a)

                            const a = reactive(obj)
                            console.log(a)
                        </lang-js>
                    `,
                    formatSourceCode(`
                        console.log(a)

                        const a = _.constReact(obj)
                        console.log(a)
                    `)
                )
            })

            test("var shallow", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            console.log(a satisfies any, b as any)

                            var a,
                                b: any = (shallow as any)(1)
                            console.log(a, b)
                        </lang-ts>
                    `,
                    formatSourceCode(`
                        const _b = _.shallowReact(_.UNDEF)
                        console.log(a satisfies any, _b.$ as any)

                        var a,
                            b: any = 1; _b.$ = b;
                        console.log(a, _b.$)
                    `)
                )
            })

            test("let shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            console.log(count)

                            let count = shallow(0)
                            console.log(count)
                        </lang-js>
                    `,
                    formatSourceCode(`
                        console.log(count)

                        let count = _.shallowReact(0)
                        console.log(count.$)
                    `)
                )
            })

            test("const shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            console.log(a)

                            const a = shallow(obj)
                            console.log(a)
                        </lang-js>
                    `,
                    formatSourceCode(`
                        console.log(a)

                        const a = _.shallowConstReact(obj)
                        console.log(a)
                    `)
                )
            })

            test("constant declarations with the literal initial values", () => {
                for (const fn of ["reactive", "shallow"]) {
                    matchTransformedScript(
                        `
                        <lang-ts>
                            console.log(a, b, c, d, e, f)

                            const a: any = (${fn} as any)()
                            const b: string = <any>(${fn})("")
                            const c = (${fn} satisfies any)(10)
                            const d = ${fn}!(null)
                            const e = ${fn}?.(() => {})
                            const f = ${fn}(function anonymous() {})
                            console.log(a, b, c, d, e, f)
                        </lang-ts>
                    `,
                        formatSourceCode(`
                        console.log(a, b, c, d, e, f)

                        const a: any = _.UNDEF
                        const b: string = ""
                        const c = 10
                        const d = null
                        const e = () => {}
                        const f = function anonymous() {}
                        console.log(a, b, c, d, e, f)
                    `)
                    )
                }
            })
        })

        describe("Destructuring", () => {
            test("var reactive", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            console.log(a, b)

                            var [a, [b]]: any = reactive(10),
                                c,
                                d;
                            console.log(a, b, c, d)
                        </lang-ts>
                    `,
                    formatSourceCode(`
                        const _a = _.react(_.UNDEF)
                        const _b = _.react(_.UNDEF)
                        console.log(_a.$, _b.$)

                        var [a, [b]]: any = 10; [_a.$, _b.$] = [a, b];
                            var c,
                            d;
                        console.log(_a.$, _b.$, c, d)
                    `)
                )
            })

            test("let reactive", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            console.log(a, b, c)
                            
                            let { a, b = { c } } = reactive(obj)
                            console.log(a, b, c)
                        </lang-ts>
                    `,
                    formatSourceCode(`
                        console.log(a, b, c)

                        let [a, b] = _.destructuringReact(({ a, b = { c } }) => [[a, 1], [b, 1]], obj)
                        console.log(a.$, b.$, c)
                    `)
                )
            })

            test("const reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            const [a, [b = c] = d] = reactive("")
                            console.log(a, b, c, d)
                        </lang-js>
                    `,
                    formatSourceCode(`
                        const [a, b] = _.destructuringConstReact(([a, [b = c] = d]) => [[a, 1], [b, 1]], "")
                        console.log(a, b, c, d)
                    `)
                )
            })

            test("var shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            console.log(a, b, c, d)

                            var [a, [b]] = shallow(obj),
                                [c = 0, ...d] = shallow(arr)
                            console.log(a, b, c, d)
                        </lang-js>
                    `,
                    formatSourceCode(`
                        const _a = _.shallowReact(_.UNDEF)
                        const _b = _.shallowReact(_.UNDEF)
                        const _c = _.shallowReact(_.UNDEF)
                        const _d = _.shallowReact(_.UNDEF)
                        console.log(_a.$, _b.$, _c.$, _d.$)

                        var [a, [b]] = obj; [_a.$, _b.$] = [a, b];
                            var [c = 0, ...d] = arr; [_c.$, _d.$] = [c, d];
                        console.log(_a.$, _b.$, _c.$, _d.$)
                    `)
                )
            })

            test("let shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            console.log(a, b, c, d, e)

                            let { a, b: c = d, ...e } = shallow(obj)
                            console.log(a, b, c, d, e)
                        </lang-js>
                    `,
                    formatSourceCode(`
                        console.log(a, b, c, d, e)
                        
                        let [a, c, e] = _.destructuringShallowReact(({ a, b: c = d, ...e }) => [[a, 1], [c, 1], [e, 1]], obj)
                        console.log(a.$, b, c.$, d, e.$)
                    `)
                )
            })

            test("const shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            console.log(a)
                            
                            const [a] = shallow?.(null)
                            console.log(a)
                        </lang-js>                        
                    `,
                    formatSourceCode(`
                        console.log(a)

                        const [a] = _.destructuringShallowConstReact(([a]) => [[a, 1]], null)
                        console.log(a)
                    `)
                )
            })
        })
    })

    describe("Implicit VariableDeclaration", () => {
        describe("Non-destructuring", () => {
            test("var reactive", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            console.log(a, b, c)

                            var a = 10,
                                b = 20,
                                c = 30
                            console.log(a, b, c)
                        </lang-ts>
                        {b++}
                    `,
                    formatSourceCode(`
                        const _b = _.react(_.UNDEF)
                        console.log(a, _b.$, c)

                        var a = 10,
                            b = 20; _b.$ = b;
                            var c = 30
                        console.log(a, _b.$, c)
                    `)
                )
            })

            test("let reactive", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            console.log(a, b, c)

                            let a = 10 as number,
                                b = 20,
                                c = obj
                            console.log(a++, b, c)
                        </lang-ts>
                        {a} + {b} + {c}
                    `,
                    formatSourceCode(`
                        console.log(a, b, c)

                        let a = _.react(10 as number),
                            b = 20,
                            c = _.react(obj)
                        console.log(a.$++, b, c.$)
                    `)
                )
            })

            test("const reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            console.log(a, b)
                            
                            const a = obj,
                                b = arr
                            console.log(a, b)
                        </lang-js>
                        {a + b}
                    `,
                    formatSourceCode(`
                        console.log(a, b)

                        const a = _.constReact(obj),
                            b = _.constReact(arr)
                        console.log(a, b)
                    `)
                )
            })

            test("var shallow", () => {
                matchTransformedScript(
                    `
                        <lang-ts shallow>
                            console.log(a, b, c)
                            
                            var a = 1,
                                b = obj,
                                c = null
                            c = 1
                            console.log(a, b, c)
                        </lang-ts>
                        {a} {b}, {c}
                    `,
                    formatSourceCode(`
                        const _b = _.shallowReact(_.UNDEF)
                        const _c = _.shallowReact(_.UNDEF)
                        console.log(a, _b.$, _c.$)

                        var a = 1,
                            b = obj; _b.$ = b;
                            var c = null; _c.$ = c;
                        _c.$ = 1
                        console.log(a, _b.$, _c.$)
                    `)
                )
            })

            test("let shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js shallow>
                            console.log(a, b, c)

                            let a = 1,
                                b = obj
                            let c = arr
                            console.log(a, b, c)
                        </lang-js>
                        {++a} {b} {c}
                    `,
                    formatSourceCode(`
                        console.log(a, b, c)

                        let a = _.shallowReact(1),
                            b = _.shallowReact(obj)
                        let c = _.shallowReact(arr)
                        console.log(a.$, b.$, c.$)
                    `)
                )
            })

            test("const shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js shallow>
                            console.log(a, b)

                            const a = 1,
                                b = arr
                            console.log(a, b)
                        </lang-js>
                        {a || b}
                    `,
                    formatSourceCode(`
                        console.log(a, b)

                        const a = 1,
                            b = _.shallowConstReact(arr)
                        console.log(a, b)
                    `)
                )
            })
        })

        describe("Destructuring", () => {
            test("var reactive", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            console.log(a, b, c, d, e)

                            var {a, b: c = d, ...e} = obj as any
                            console.log(a, b, c, d, e)
                        </lang-ts>
                        {(a, b, c, d)}
                    `,
                    formatSourceCode(`
                        const _a = _.react(_.UNDEF)
                        const _c = _.react(_.UNDEF)
                        console.log(_a.$, b, _c.$, d, e)

                        var {a, b: c = d, ...e} = obj as any; [_a.$, _c.$] = [a, c];
                        console.log(_a.$, b, _c.$, d, e)
                    `)
                )
            })

            test("let reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            console.log(a, b, c, d, e)
                        
                            let [a, [b = c] = d, ...e] = arr
                            console.log(a, b, c, d, e)
                        </lang-js>
                        {(a, c, d, e)}
                    `,
                    formatSourceCode(`
                        console.log(a, b, c, d, e)

                        let [a, b, e] = _.destructuringReact(([a, [b = c] = d, ...e]) => [[a, 1], [b, 0], [e, 1]], arr)
                        console.log(a.$, b, c, d, e.$)
                    `)
                )
            })

            test("const reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            console.log(a, b, c)

                            const { a, b: { c } } = obj
                            console.log(a, b, c)
                        </lang-js>
                        {a ?? b ?? c}
                    `,
                    formatSourceCode(`
                        console.log(a, b, c)

                        const [a, c] = _.destructuringConstReact(({ a, b: { c } }) => [[a, 1], [c, 1]], obj)
                        console.log(a, b, c)
                    `)
                )
            })

            test("var shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js shallow>
                            console.log(a, b, c, d)
                            
                            var [a, [b, ...c], ...d] = ""
                            console.log(a, b, c, d)
                        </lang-js>
                        {(a, b, c, d)}
                    `,
                    formatSourceCode(`
                        const _a = _.shallowReact(_.UNDEF)
                        const _b = _.shallowReact(_.UNDEF)
                        const _c = _.shallowReact(_.UNDEF)
                        const _d = _.shallowReact(_.UNDEF)
                        console.log(_a.$, _b.$, _c.$, _d.$)

                        var [a, [b, ...c], ...d] = ""; [_a.$, _b.$, _c.$, _d.$] = [a, b, c, d];
                        console.log(_a.$, _b.$, _c.$, _d.$)
                    `)
                )
            })

            test("let shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js shallow>
                            console.log(a, b, c)

                            let [a, [b], ...c] = arr
                            console.log(a, b, c)
                        </lang-js>
                        {a + b}
                    `,
                    formatSourceCode(`
                        console.log(a, b, c)

                        let [a, b, c] = _.destructuringShallowReact(([a, [b], ...c]) => [[a, 1], [b, 1], [c, 0]], arr)
                        console.log(a.$, b.$, c)
                    `)
                )
            })

            test("const shallow", () => {
                matchTransformedScript(
                    `
                        <lang-ts shallow>
                            console.log(a, b, c, d, e)

                            const { a, b: { c } = d, ...e }: any = obj satisfies Record<string, string>
                            console.log(a, b, c, d, e)
                        </lang-ts>
                        {(a, b, d, e)}
                    `,
                    formatSourceCode(`
                        console.log(a, b, c, d, e)

                        const [a, c, e] = _.destructuringShallowConstReact(({ a, b: { c } = d, ...e }: any) => [[a, 1], [c, 0], [e, 1]], obj satisfies Record<string, string>)
                        console.log(a, b, c, d, e)
                    `)
                )
            })
        })
    })

    describe("Implicit FunctionDeclaration", () => {
        test("reactive", () => {
            matchTransformedScript(
                `
                    <lang-js>
                        console.log(a, b, c)

                        function a() {}
                        function b() {}
                        function c() {}
                        b = c = null
                        console.log(a, b, c)
                    </lang-js>
                    {(a, c)}
                `,
                formatSourceCode(`
                    const _c = _.react(c)
                    console.log(a, b, _c.$)

                    function a() {}
                    function b() {}
                    function c() {}
                    b = _c.$ = null
                    console.log(a, b, _c.$)
                `)
            )
        })

        test("shallow", () => {
            matchTransformedScript(
                `
                    <lang-ts shallow>
                        console.log(a)

                        function a<T>(...args: any) {}
                        console.log(a)
                    </lang-ts>
                    {a = undefined}
                `,
                formatSourceCode(`
                    const _a = _.shallowReact(a)
                    console.log(_a.$)

                    function a<T>(...args: any) {}
                    console.log(_a.$)
                `)
            )
        })
    })

    describe("Implicit ClassDeclaration", () => {
        test("reactive", () => {
            matchTransformedScript(
                `
                    <lang-js>
                        console.log(A)

                        class A {}
                        console.log(A ??= B)
                    </lang-js>
                    {A}
                `,
                formatSourceCode(`
                    console.log(A)

                    let A = _.react(class A {})
                    console.log(A.$ ??= B)
                `)
            )
        })

        test("shallow", () => {
            matchTransformedScript(
                `
                    <lang-js shallow>
                        console.log(A, B, C)

                        class A {}
                        class B {}
                        class C {}
                        A = B = null
                        console.log(A, B, C)
                    </lang-js>
                    {(A, C)}
                `,
                formatSourceCode(`
                    console.log(A, B, C)

                    let A = _.shallowReact(class A {})
                    class B {}
                    class C {}
                    A.$ = B = null
                    console.log(A.$, B, C)
                `)
            )
        })
    })

    describe("Implicit TSEnumDeclaration", () => {
        test("reactive", () => {
            matchTransformedScript(
                `
                    <lang-ts>
                        console.log(a, b, c)

                        enum a {}
                        enum b {}
                        enum c {}

                        enum a {}
                        console.log(a, b, c)
                    </lang-ts>
                    {(a, b, c)}
                `,
                formatSourceCode(`
                    console.log(a, b, c)

                    const _a = _.react({})
                    enum a {}
                    _.objectAssign(_a.$ ??= {}, a);
                    const _b = _.react({})
                    enum b {}
                    _.objectAssign(_b.$ ??= {}, b);
                    const _c = _.react({})
                    enum c {}
                    _.objectAssign(_c.$ ??= {}, c);

                    enum a {}
                    _.objectAssign(_a.$ ??= {}, a);
                    console.log(_a.$, _b.$, _c.$)
                `)
            )
        })

        test("shallow", () => {
            matchTransformedScript(
                `
                    <lang-ts shallow>
                        console.log(a, b)

                        enum a {}
                        enum a {}
                        enum b {}
                        console.log(a, b)
                    </lang-ts>
                    {(a = 1, b)}
                `,
                formatSourceCode(`
                    console.log(a, b)

                    const _a = _.shallowReact({})
                    enum a {}
                    _a.$ = a;
                    enum a {}
                    _a.$ = a;
                    const _b = _.shallowReact({})
                    enum b {}
                    _b.$ = b;
                    console.log(_a.$, _b.$)
                `)
            )
        })
    })
})

describe("Development", () => {
    const matchTransformedScript = (source: string, expected: string) => {
        _matchTransformedScript(source, expected, {
            debug: true
        })
    }
    describe("Explicit VariableDeclaration", () => {
        describe("Non-destructuring", () => {
            test("var reactive", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            a + b

                            var a = reactive<number>(1),
                                b = reactive<string>("x")

                            a++
                            b ??= String(a)
                            a && b
                        </lang-ts>
                    `,
                    formatSourceCode(`
                        const [_a] = _.react(_.UNDEF, v => (a = v))
                        const [_b] = _.react(_.UNDEF, v => (b = v))
                        _a.$ + _b.$

                        var a = 1; _a.$ = a;
                            var b = "x"; _b.$ = b;

                        _a.$++
                        _b.$ ??= String(_a.$)
                        _a.$ && _b.$
                    `)
                )
            })

            test("let reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            count * 2

                            let count = reactive?.(0)
                            count &&= 1
                            count ?? 5
                        </lang-js>
                    `,
                    formatSourceCode(`
                        const _S1 = v => (count = v)
                        count * 2
                        
                        let [_count, count] = _.react?.(0, _S1)
                        _count.$ &&= 1
                        _count.$ ?? 5
                    `)
                )
            })

            test("const reactive", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            obj?.a

                            const obj = reactive<{a: number}>({ a: 1 } as const)
                            obj.a
                            obj["a"]
                        </lang-ts>
                    `,
                    formatSourceCode(`
                        obj?.a

                        const obj = _.constReact<{a: number}>({ a: 1 } as const)
                        obj.a
                        obj["a"]
                    `)
                )
            })

            test("var shallow", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            a ?? 0

                            var a: number | undefined = shallow<number>()
                            a ||= 10
                            a &&= 20
                        </lang-ts>
                    `,
                    formatSourceCode(`
                        const [_a] = _.shallowReact(_.UNDEF, v => (a = v))
                        _a.$ ?? 0

                        var a: number | undefined = _.UNDEF; _a.$ = a;
                        _a.$ ||= 10
                        _a.$ &&= 20
                    `)
                )
            })

            test("let shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            list.length

                            let _list,
                                list = shallow([1,2,3])
                            for (const i of list) i;
                            [...list]
                        </lang-js>
                    `,
                    formatSourceCode(`
                        const _S1 = v => (list = v)
                        list.length

                        let _list,
                            [_list1, list] = _.shallowReact([1,2,3], _S1)
                        for (const i of _list1.$) i;
                        [..._list1.$]
                    `)
                )
            })

            test("const shallow", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            fn?.()

                            const fn = shallow<(x:number)=>number>(foo)
                            fn(1)
                            fn?.()
                        </lang-ts>
                    `,
                    formatSourceCode(`
                        fn?.()

                        const fn = _.shallowConstReact<(x:number)=>number>(foo)
                        fn(1)
                        fn?.()
                    `)
                )
            })

            test("constant declarations with the literal initial values", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            a, b, c, d

                            const a = reactive(null)
                            const b = shallow("")
                            const c = reactive(undefined)
                            const d = shallow?.(123)
                            void(\`\${a}\${b}\${c}\${d}\`)
                        </lang-ts>
                    `,
                    formatSourceCode(`
                        a, b, c, d

                        const a = null
                        const b = ""
                        const c = undefined
                        const d = 123
                        void(\`\${a}\${b}\${c}\${d}\`)
                    `)
                )
            })
        })

        describe("Destructuring", () => {
            test("var reactive", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            a * c

                            var { a, b: { c } } = reactive({ a: 1, b: { c: 2 } })
                            a ?? c
                        </lang-ts>
                    `,
                    formatSourceCode(`
                        const [_a] = _.react(_.UNDEF, v => (a = v))
                        const [_c] = _.react(_.UNDEF, v => (c = v))
                        _a.$ * _c.$

                        var { a, b: { c } } = { a: 1, b: { c: 2 } }; [_a.$, _c.$] = [a, c];
                        _a.$ ?? _c.$
                    `)
                )
            })

            test("let reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            x ?? y

                            let _x,
                                _y,
                                [x = 1, ...y] = reactive([0,2,3])
                            y.length && x
                        </lang-js>
                    `,
                    formatSourceCode(`
                        const _S1 = v => (x = v)
                        const _S2 = v => (y = v)
                        x ?? y

                        let _x,
                            _y,
                            [[_x1, x], [_y1, y]] = _.destructuringReact(([x = 1, ...y]) => [[x, 1], [y, 1]], [0,2,3], [_S1, _S2])
                        _y1.$.length && _x1.$
                    `)
                )
            })

            test("const reactive", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            a

                            const [a] = reactive?.([10])
                            a &&= 2
                        </lang-ts>
                    `,
                    formatSourceCode(`
                        a

                        const [a] = _.destructuringConstReact(([a]) => [[a, 1]], [10])
                        a &&= 2
                    `)
                )
            })

            test("var shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            a + b

                            var [a, { b }] = shallow([{ b: 1 }])
                            a ?? b
                        </lang-js>
                    `,
                    formatSourceCode(`
                        const [_a] = _.shallowReact(_.UNDEF, v => (a = v))
                        const [_b] = _.shallowReact(_.UNDEF, v => (b = v))
                        _a.$ + _b.$

                        var [a, { b }] = [{ b: 1 }]; [_a.$, _b.$] = [a, b];
                        _a.$ ?? _b.$
                    `)
                )
            })

            test("let shallow", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            a ?? rest

                            let { a, ...rest } = shallow({ a: 1, b: 2 })
                            rest[a]
                        </lang-ts>
                    `,
                    formatSourceCode(`
                        const _S1 = v => (a = v)
                        const _S2 = v => (rest = v)
                        a ?? rest

                        let [[_a, a], [_rest, rest]] = _.destructuringShallowReact(({ a, ...rest }) => [[a, 1], [rest, 1]], { a: 1, b: 2 }, [_S1, _S2])
                        _rest.$[_a.$]
                    `)
                )
            })

            test("const shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            a

                            const { a = 1 } = shallow?.({})
                            ++a
                        </lang-js>
                    `,
                    formatSourceCode(`
                        a

                        const [a] = _.destructuringShallowConstReact(({ a = 1 }) => [[a, 1]], {})
                        ++a
                    `)
                )
            })
        })
    })

    describe("Implicit VariableDeclaration", () => {
        describe("Non-destructuring", () => {
            test("var reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            a

                            var a = 1
                            a++
                        </lang-js>
                        {a * 2}
                    `,
                    formatSourceCode(`
                        const [_a] = _.react(_.UNDEF, v => (a = v))
                        _a.$

                        var a = 1; _a.$ = a;
                        _a.$++
                    `)
                )
            })

            test("let reactive", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            a

                            let a = 1 satisfies number
                            a ??= 2
                        </lang-ts>
                        {a}
                    `,
                    formatSourceCode(`
                        const _S1 = v => (a = v)
                        a

                        let [_a, a] = _.react(1 satisfies number, _S1)
                        _a.$ ??= 2
                    `)
                )
            })

            test("const reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            obj.a

                            const obj = { a: 1 }
                            obj?.a
                        </lang-js>
                        {obj}
                    `,
                    formatSourceCode(`
                        obj.a

                        const obj = _.constReact({ a: 1 })
                        obj?.a
                    `)
                )
            })

            test("var shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js shallow>
                            a

                            var a = 0
                            a ||= 1
                        </lang-js>
                        {a}
                    `,
                    formatSourceCode(`
                        const [_a] = _.shallowReact(_.UNDEF, v => (a = v))
                        _a.$

                        var a = 0; _a.$ = a;
                        _a.$ ||= 1
                    `)
                )
            })

            test("let shallow", () => {
                matchTransformedScript(
                    `
                        <lang-ts shallow>
                            a

                            let a: number | null = null
                            a ??= 1
                        </lang-ts>
                        {a}
                    `,
                    formatSourceCode(`
                        const _S1 = v => (a = v)
                        a

                        let [_a, a] = _.shallowReact(null, _S1)
                        _a.$ ??= 1
                    `)
                )
            })

            test("const shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js shallow>
                            a

                            const a = obj
                            a + 1
                        </lang-js>
                        {a}
                    `,
                    formatSourceCode(`
                        a

                        const a = _.shallowConstReact(obj)
                        a + 1
                    `)
                )
            })
        })

        describe("Destructuring", () => {
            test("var reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            a

                            var { a } = { a: 1 }
                            a++
                        </lang-js>
                        {a}
                    `,
                    formatSourceCode(`
                        const [_a] = _.react(_.UNDEF, v => (a = v))
                        _a.$

                        var { a } = { a: 1 }; [_a.$] = [a];
                        _a.$++
                    `)
                )
            })

            test("let reactive", () => {
                matchTransformedScript(
                    `
                        <lang-ts>
                            a

                            let [a] = [1]
                            a &&= 2
                        </lang-ts>
                        {a}
                    `,
                    formatSourceCode(`
                        const _S1 = v => (a = v)
                        a

                        let [[_a, a]] = _.destructuringReact(([a]) => [[a, 1]], [1], [_S1])
                        _a.$ &&= 2
                    `)
                )
            })

            test("const reactive", () => {
                matchTransformedScript(
                    `
                        <lang-js>
                            a

                            const { a } = { a: 1 }
                            a ?? 0
                        </lang-js>
                        {a}
                    `,
                    formatSourceCode(`
                        a

                        const [a] = _.destructuringConstReact(({ a }) => [[a, 1]], { a: 1 })
                        a ?? 0
                    `)
                )
            })

            test("var shallow", () => {
                matchTransformedScript(
                    `
                    <lang-js shallow>
                        a

                        var [a, b] = [1, 2]
                        b = a++
                    </lang-js>
                    {(a, b)}
                    `,
                    formatSourceCode(`
                        const [_a] = _.shallowReact(_.UNDEF, v => (a = v))
                        const [_b] = _.shallowReact(_.UNDEF, v => (b = v))
                        _a.$

                        var [a, b] = [1, 2]; [_a.$, _b.$] = [a, b];
                        _b.$ = _a.$++
                    `)
                )
            })

            test("let shallow", () => {
                matchTransformedScript(
                    `
                        <lang-ts shallow>
                            a

                            let { a } = { a: 1 }
                            a &&= 3
                        </lang-ts>
                        {a}
                    `,
                    formatSourceCode(`
                        const _S1 = v => (a = v)
                        a

                        let [[_a, a]] = _.destructuringShallowReact(({ a }) => [[a, 1]], { a: 1 }, [_S1])
                        _a.$ &&= 3
                    `)
                )
            })

            test("const shallow", () => {
                matchTransformedScript(
                    `
                        <lang-js shallow>
                            a

                            const [a] = [1]
                            a ??= 5
                        </lang-js>
                        {a}
                    `,
                    formatSourceCode(`
                        a

                        const [a] = _.destructuringShallowConstReact(([a]) => [[a, 1]], [1])
                        a ??= 5
                    `)
                )
            })
        })
    })

    describe("Implicit FunctionDeclaration", () => {
        test("reactive", () => {
            matchTransformedScript(
                `
                    <lang-ts>
                    a?.(b())

                    function a<T>():T {}
                    function b() {}
                    ;(b ??= ()=>{})(a())
                    </lang-ts>
                    {a(b())}
                `,
                formatSourceCode(`
                    const [_b] = _.react(b, v => (b = v))
                    a?.(_b.$())

                    function a<T>():T {}
                    function b() {}
                    ;(_b.$ ??= ()=>{})(a())
                `)
            )
        })

        test("shallow", () => {
            matchTransformedScript(
                `
                    <lang-ts shallow>
                        ;(a as any)()

                        function a() {}
                        ;(a satisfies Function)!()
                    </lang-ts>
                    {a = NOOP}
                `,
                formatSourceCode(`
                    const [_a] = _.shallowReact(a, v => (a = v))
                    ;(_a.$ as any)()

                    function a() {}
                    ;(_a.$ satisfies Function)!()
                `)
            )
        })
    })

    describe("Implicit ClassDeclaration", () => {
        test("reactive", () => {
            matchTransformedScript(
                `
                    <lang-ts>
                        new A(new B())
                        
                        class A {}
                        class B {}
                        new B!(new A!())
                    </lang-ts>
                    {A = B = Object}
                `,
                formatSourceCode(`
                    const _S1 = v => (A = v)
                    const _S2 = v => (B = v)
                    new A(new B())

                    let [_A, A] = _.react(class A {}, _S1)
                    let [_B, B] = _.react(class B {}, _S2)
                    new _B.$!(new _A.$!())
                `)
            )
        })

        test("shallow", () => {
            matchTransformedScript(
                `
                    <lang-js shallow>
                        new A()

                        class A {}
                        A.static()
                    </lang-js>
                    {A = Array}
                `,
                formatSourceCode(`
                    const _S1 = v => (A = v)
                    new A()

                    let [_A, A] = _.shallowReact(class A {}, _S1)
                    _A.$.static()
                `)
            )
        })
    })

    describe("Implicit TSEnumDeclaration", () => {
        test("reactive", () => {
            matchTransformedScript(
                `
                    <lang-ts>
                        a.b = b.a
                    
                        enum a {}
                        enum b {}
                        enum a {}
                        console.log(b, a)
                    </lang-ts>
                    {(b = {}, a)}
                `,
                formatSourceCode(`
                    a.b = b.a

                    const [_a] = _.react({}, v => (a = v))
                    enum a {}
                    _.objectAssign(_a.$ ??= {}, a);
                    const [_b] = _.react({}, v => (b = v))
                    enum b {}
                    _.objectAssign(_b.$ ??= {}, b);
                    enum a {}
                    _.objectAssign(_a.$ ??= {}, a);
                    console.log(_b.$, _a.$)
                `)
            )
        })

        test("shallow", () => {
            matchTransformedScript(
                `
                    <lang-ts shallow>
                        console.log(a, b)

                        enum a {}
                        enum b {}
                        console.log(a, b)
                    </lang-ts>
                    {a}
                `,
                formatSourceCode(`
                    console.log(a, b)

                    const [_a] = _.shallowReact({}, v => (a = v))
                    enum a {}
                    _a.$ = a;
                    enum b {}
                    console.log(_a.$, b)
                `)
            )
        })
    })
})
