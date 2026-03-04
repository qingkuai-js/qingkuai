import { test } from "vitest"
import { matchTransformedScript } from "./_match"
import { formatSourceCode } from "../../../src/util/testing/sundry"

test("Transform result of alias in production environment", () => {
    matchTransformedScript(
        `
            <lang-ts>
                console.log(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u)
                
                const a = 1,
                    b = alias(props.b)
                const { c, d: { e } } = alias(props), f = 2,
                    g = 3
                const h = 4,
                    [i, j, [k], [l, m]] = alias(arr), n = 5
                let o = 6,
                    p = 7,
                    { q: r } = alias(props),
                    s = 8,
                    t = 9
                const u = alias(props.u)
                console.log(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u)
            </lang-ts>
        `,
        formatSourceCode(`
            console.log(a, props.b, props.c, d, props.d.e, f, g, h, arr[0], arr[1], arr[2][0], arr[3][0], arr[3][1], n, o, p, q, props.q, s, t, props.u)

            const a = 1
            const f = 2,
                g = 3
            const h = 4, n = 5
            let o = 6,
                p = 7,
                s = 8,
                t = 9
            console.log(a, props.b, props.c, d, props.d.e, f, g, h, arr[0], arr[1], arr[2][0], arr[3][0], arr[3][1], n, o, p, q, props.q, s, t, props.u)
        `)
    )
})

test("Transform result of alias in development environment", () => [
    matchTransformedScript(
        `
            <lang-ts>
                console.log(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u)
                
                const a = 1,
                    b = alias(props.b)
                const { c, d: { e } } = alias(props), f = 2,
                    g = 3
                const h = 4,
                    [i, j, [k], [l, m]] = alias(arr), n = 5
                let o = 6,
                    p = 7,
                    { q: r } = alias(props),
                    s = 8,
                    t = 9
                const u = alias(props.u)
                console.log(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u)
            </lang-ts>
        `,
        formatSourceCode(`
            const _G1 = () => ([props, "b"])
            const _S1 = v => (b = v)
            const _G2 = () => ([props, "c"])
            const _S2 = v => (c = v)
            const _G3 = () => ([props.d, "e"])
            const _S3 = v => (e = v)
            const _G4 = () => ([arr, 0])
            const _S4 = v => (i = v)
            const _G5 = () => ([arr, 1])
            const _S5 = v => (j = v)
            const _G6 = () => ([arr[2], 0])
            const _S6 = v => (k = v)
            const _G7 = () => ([arr[3], 0])
            const _S7 = v => (l = v)
            const _G8 = () => ([arr[3], 1])
            const _S8 = v => (m = v)
            const _G9 = () => ([props, "q"])
            const _S9 = v => (r = v)
            const _G10 = () => ([props, "u"])
            const _S10 = v => (u = v)
            console.log(a, _b.$, _c.$, d, _e.$, f, g, h, _i.$, _j.$, _k.$, _l.$, _m.$, n, o, p, q, _r.$, s, t, _u.$)
            
            const a = 1;
                let [_b, b] = _.alias(_G1, _S1)
            let [[_c, c], [_e, e]] = _.destructuringAlias([_G2, _G3], [_S2, _S3]); const f = 2,
                g = 3
            const h = 4;
                let [[_i, i], [_j, j], [_k, k], [_l, l], [_m, m]] = _.destructuringAlias([_G4, _G5, _G6, _G7, _G8], [_S4, _S5, _S6, _S7, _S8]); const n = 5
            let o = 6,
                p = 7,
                [[_r, r]] = _.destructuringAlias([_G9], [_S9]),
                s = 8,
                t = 9
            let [_u, u] = _.alias(_G10, _S10)
            console.log(a, _b.$, _c.$, d, _e.$, f, g, h, _i.$, _j.$, _k.$, _l.$, _m.$, n, o, p, q, _r.$, s, t, _u.$)
        `),
        {
            debug: true
        }
    )
])
