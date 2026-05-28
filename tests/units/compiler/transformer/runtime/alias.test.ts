import { test } from "vitest"
import { matchTransformedScript } from "./_match"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"

function localMatchTransformedScript(expected: string, debugMode: boolean) {
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
        formatSourceCode(expected),
        { debug: debugMode }
    )
}

test("Transform result of alias in production environment", () => {
    localMatchTransformedScript(
        `
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
        `,
        false
    )
})

test("Transform result of alias in development environment", () => [
    localMatchTransformedScript(
        `
            const _G1 = __ => ([props, "b"])
            const _G2 = __ => ([props, "c"])
            const _G3 = __ => ([props.d, "e"])
            const _G4 = __ => ([arr, 0])
            const _G5 = __ => ([arr, 1])
            const _G6 = __ => ([arr[2], 0])
            const _G7 = __ => ([arr[3], 0])
            const _G8 = __ => ([arr[3], 1])
            const _G9 = __ => ([props, "q"])
            const _G10 = __ => ([props, "u"])
            console.log(a, b[_.REFERENCE_VALUE], c[_.REFERENCE_VALUE], d, e[_.REFERENCE_VALUE], f, g, h, i[_.REFERENCE_VALUE], j[_.REFERENCE_VALUE], k[_.REFERENCE_VALUE], l[_.REFERENCE_VALUE], m[_.REFERENCE_VALUE], n, o, p, q, r[_.REFERENCE_VALUE], s, t, u[_.REFERENCE_VALUE])
            
            const a = 1;
                let b = _.alias(_G1)
            let [c, e] = _.destructuringAlias(_G2, _G3); const f = 2,
                g = 3
            const h = 4;
                let [i, j, k, l, m] = _.destructuringAlias(_G4, _G5, _G6, _G7, _G8); const n = 5
            let o = 6,
                p = 7,
                [r] = _.destructuringAlias(_G9),
                s = 8,
                t = 9
            let u = _.alias(_G10)
            console.log(a, b[_.REFERENCE_VALUE], c[_.REFERENCE_VALUE], d, e[_.REFERENCE_VALUE], f, g, h, i[_.REFERENCE_VALUE], j[_.REFERENCE_VALUE], k[_.REFERENCE_VALUE], l[_.REFERENCE_VALUE], m[_.REFERENCE_VALUE], n, o, p, q, r[_.REFERENCE_VALUE], s, t, u[_.REFERENCE_VALUE])
        `,
        true
    )
])
