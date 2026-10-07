import type { Getter } from "#type-declarations/tools"

import {
    react,
    derived,
    initRefs,
    initProps,
    initContexts,
    setContextGetter
} from "../../../src/runtime/internal"
import { initDestruction } from "../../../src/util/testing/sundry"
import { describe, expect, test } from "vitest"

initDestruction()

describe("derived tracking through intrinsic getters", () => {
    test("derived recomputes when a refs property is written", () => {
        const v = react(1)
        const refs = initRefs({ r: { val: [(): any => v.$, (s: any) => (v.$ = s)] } }) as any
        const doubled: any = derived(() => refs.val * 2)

        expect(refs.val).toBe(1)
        expect(doubled.$).toBe(2)

        refs.val = 2
        expect(refs.val).toBe(2)
        expect(doubled.$).toBe(4)

        refs.val = 3
        expect(doubled.$).toBe(6)
    })

    test("derived recomputes when the reactive value behind props changes", () => {
        const v = react(1)
        const props = initProps({ p: { val: (): any => v.$ } }) as any
        const doubled: any = derived(() => props.val * 2)

        expect(props.val).toBe(1)
        expect(doubled.$).toBe(2)

        v.$ = 2
        expect(props.val).toBe(2)
        expect(doubled.$).toBe(4)
    })

    test("derived recomputes when the reactive value behind a context changes", () => {
        const v = react(10)
        const meta: any = { c: {} }
        initContexts(meta)
        setContextGetter({ _internal: meta } as any, "theme", (): any => v.$)
        const contexts = meta.c as any
        const doubled: any = derived(() => contexts.theme * 2)

        expect(contexts.theme).toBe(10)
        expect(doubled.$).toBe(20)

        v.$ = 20
        expect(contexts.theme).toBe(20)
        expect(doubled.$).toBe(40)
    })

    test("plain reactive reads keep triggering derived recomputation", () => {
        const n = react(5)
        const tripled: any = derived(() => n.$ * 3)

        expect(tripled.$).toBe(15)
        n.$ = 6
        expect(tripled.$).toBe(18)
    })

    test("multiple derived values bound to the same refs property stay in sync", () => {
        const v = react(1)
        const refs = initRefs({ r: { val: [(): any => v.$, (s: any) => (v.$ = s)] } }) as any
        const doubled: any = derived(() => refs.val * 2)
        const squared: any = derived(() => refs.val * refs.val)

        expect(doubled.$).toBe(2)
        expect(squared.$).toBe(1)

        refs.val = 4
        expect(doubled.$).toBe(8)
        expect(squared.$).toBe(16)
    })
})
