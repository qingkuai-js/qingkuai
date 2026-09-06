import type { ComponentInstanceBase } from "#type-declarations/runtime"

import {
    mount,
    onAfterMount,
    onBeforeUpdate,
    onBeforeDestroy,
    onAfterDestroy
} from "../../../src/runtime/component"
import { setCurrentInstance } from "../../../src/runtime/state"
import { describe, expect, test, beforeEach, vi } from "vitest"
import { createWarningMatcher } from "../../../src/util/testing/sundry"
import { COMPONENT_MOUNTED, COMPONENT_UPDATING, NIL } from "../../../src/runtime/constants"

const warningMatcher = createWarningMatcher()

beforeEach(() => {
    warningMatcher.mockClear()
})

function createInstance() {
    return {
        _internal: {
            d: {
                d: false
            },
            l: 0,
            f: NIL
        },
        parent: null
    } as unknown as ComponentInstanceBase
}

describe("Lifecycle hook registration guards", () => {
    test("onAfterMount registers normally before mount", () => {
        const instance = createInstance()
        const callback = vi.fn()

        onAfterMount(instance, callback)

        expect(warningMatcher).not.toHaveBeenCalled()
        expect(instance._internal.f?.[1]).toEqual([callback])
    })

    test("onAfterMount registration after mount warns 8004 and is ignored", () => {
        const instance = createInstance()
        instance._internal.l = COMPONENT_MOUNTED

        onAfterMount(instance, vi.fn())

        expect(
            warningMatcher.mock.calls.some(args => args.join(" ").includes("onAfterMount"))
        ).toBe(true)
        expect(instance._internal.f?.[1]).toBeUndefined()
        expect(warningMatcher.mock.calls.some(args => args.join(" ").includes("8004"))).toBe(true)
    })

    test("destroy hook registrations before destroy do not warn", () => {
        const instance = createInstance()

        onBeforeDestroy(instance, vi.fn())
        onAfterDestroy(instance, vi.fn())

        expect(warningMatcher).not.toHaveBeenCalled()
        expect(instance._internal.f?.[4]).toHaveLength(1)
        expect(instance._internal.f?.[5]).toHaveLength(1)
    })

    test("destroy hook registrations after destroy warn 8004 and are ignored", () => {
        const instance = createInstance()
        instance._internal.d = { d: true } as any

        onBeforeDestroy(instance, vi.fn())
        onAfterDestroy(instance, vi.fn())

        expect(instance._internal.f?.[4]).toBeUndefined()
        expect(instance._internal.f?.[5]).toBeUndefined()
        expect(
            warningMatcher.mock.calls.filter(args => args.join(" ").includes("8004"))
        ).toHaveLength(2)
        expect(
            warningMatcher.mock.calls.some(args => args.join(" ").includes("onAfterDestroy"))
        ).toBe(true)
    })

    test("update hook registration after mount does not warn (recurring window)", () => {
        const instance = createInstance()
        instance._internal.l = COMPONENT_MOUNTED | COMPONENT_UPDATING

        onBeforeUpdate(instance, vi.fn())

        expect(warningMatcher).not.toHaveBeenCalled()
        expect(instance._internal.f?.[2]).toHaveLength(1)
    })

    test("mount() drains onAfterMount callbacks and then marks the instance mounted", () => {
        const instance = createInstance()
        const callback = vi.fn()
        onAfterMount(instance, callback)

        setCurrentInstance(instance)
        mount()
        setCurrentInstance(null)

        expect(callback).toHaveBeenCalledTimes(1)
        expect((instance._internal.l ?? 0) & COMPONENT_MOUNTED).toBe(COMPONENT_MOUNTED)
    })

    test("registering onAfterMount inside an onAfterMount callback does not warn", () => {
        const instance = createInstance()
        onAfterMount(instance, () => onAfterMount(instance, vi.fn()))

        setCurrentInstance(instance)
        mount()
        setCurrentInstance(null)

        expect(warningMatcher).not.toHaveBeenCalled()
        expect(instance._internal.f?.[1]).toHaveLength(2)
    })
})
