import { beforeEach, describe, expect, test } from "vitest"

import {
    init,
    setContext,
    getContexts,
    initContexts,
    applyDefaults,
    setContextGetter
} from "../../../src/runtime/component"
import { syncEffect } from "../../../src/runtime"
import { setCurrentInstance } from "../../../src/runtime/state"
import { constReact, makeExpGetter } from "../../../src/runtime/internal"
import { initDestruction, createTestInstance } from "../../../src/util/testing/sundry"

initDestruction()

// 构造一个 contexts 层已由 init 构建的测试实例
// Build a test instance whose contexts layer is already built (as `init` does).
function makeInstance(parentC?: object | null) {
    const instance: any = {
        _internal: {
            c: Object.create(parentC ?? null)
        }
    }
    return instance
}

// 每个测试前把 currentInstance 指向一个真实销毁上下文，供 applyDefaults 使用
// Point currentInstance at a real destruction context so applyDefaults works.
beforeEach(() => {
    const instance = createTestInstance()
    setCurrentInstance(instance)
    ;(instance as any)._internal.D = {}
})

describe("contexts runtime", () => {
    test("initContexts returns the chain head with null prototype for root", () => {
        const instance = makeInstance()
        const head = initContexts(instance._internal)
        expect(head).toBe(instance._internal.c)
        expect(Object.getPrototypeOf(head)).toBe(null)
    })

    test("setContext defines accessor and child shadows parent along prototype chain", () => {
        const parent = makeInstance()
        setContext(parent, "user", "A")
        setContext(parent, "shared", "P")

        const child = makeInstance(parent._internal.c)
        setContext(child, "user", "B")
        expect(child._internal.c.user).toBe("B")
        expect(parent._internal.c.user).toBe("A")
        expect(child._internal.c.shared).toBe("P")
    })

    test("setContext stores function values as-is and falls back to defaults", () => {
        const instance = makeInstance()
        const fn = () => "computed"
        setContext(instance, "theme", fn)

        // 普通函数值原样存储，读取时不调用。
        // A plain function value is stored as-is and not invoked on read.
        expect(instance._internal.c.theme).toBe(fn)

        // applyDefaults 作用于 currentInstance；把 instance 设为 currentInstance
        // applyDefaults targets currentInstance; make it current first.
        setCurrentInstance(instance as any)
        applyDefaults({ contexts: { missing: "defaulted" } })
        expect(instance._internal.c.missing).toBe("defaulted")
    })

    test("makeExpGetter marks getter so setContext invokes it, and falls back to defaults", () => {
        const instance = makeInstance()
        const fn = () => "computed"
        const wrapped = makeExpGetter(fn)
        expect(wrapped.f).toBe(fn)
        expect(wrapped).toHaveProperty("__qk__exp_getter", true)

        setContext(instance, "theme", wrapped)
        expect(instance._internal.c.theme).toBe("computed")

        setCurrentInstance(instance as any)
        applyDefaults({ contexts: { missing: "defaulted" } })
        expect(instance._internal.c.missing).toBe("defaulted")
    })

    test("setContextGetter wraps getter and keeps context reads reactive", () => {
        const theme = constReact({ name: "dark" })
        const instance = makeInstance()
        setContextGetter(instance, "theme", () => theme.name)

        const seen: any[] = []
        const effectInstance = createTestInstance()
        syncEffect(effectInstance, () => {
            seen.push(instance._internal.c.theme)
        })
        expect(seen[0]).toBe("dark")

        theme.name = "light"
        expect(seen[seen.length - 1]).toBe("light")
    })

    test("setContext with only a key falls back to defaults on read", () => {
        const instance = makeInstance()
        setCurrentInstance(instance as any)
        applyDefaults({ contexts: { solo: "default-solo" } })
        setContext(instance, "solo", undefined)
        expect(instance._internal.c.solo).toBe("default-solo")
    })

    test("reactive value propagates to reader via getter and effect re-runs", () => {
        const theme = constReact({ name: "dark" })
        const instance = makeInstance()
        setContext(
            instance,
            "theme",
            makeExpGetter(() => theme.name)
        )

        const seen: any[] = []
        const effectInstance = createTestInstance()
        syncEffect(effectInstance, () => {
            seen.push(instance._internal.c.theme)
        })
        expect(seen[0]).toBe("dark")

        theme.name = "light"
        expect(seen[seen.length - 1]).toBe("light")
    })

    test("getContexts returns the chain head", () => {
        const instance = makeInstance()
        setContext(instance, "k", 1)
        expect(getContexts(instance)).toBe(instance._internal.c)
    })

    test("contexts layer chains to the parent instance's layer", () => {
        const makeAnchor = () => ({ parentElement: {} as Element }) as unknown as Text

        const parentContext: any = {}
        init(makeAnchor(), parentContext)

        const childContext: any = {}
        init(makeAnchor(), childContext)

        expect(Object.getPrototypeOf(childContext.c)).toBe(parentContext.c)
    })

    test("re-setting the same key applies the last write", () => {
        const instance = makeInstance()
        setContext(instance, "k", 1)
        setContext(instance, "k", 2)
        expect(instance._internal.c.k).toBe(2)
    })
})
