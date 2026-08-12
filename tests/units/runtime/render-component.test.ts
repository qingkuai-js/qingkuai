import { afterEach, beforeEach, test, expect, vi } from "vitest"

import { setCurrentInstance } from "../../../src/runtime/state"
import { renderComponent } from "../../../src/runtime/component"
import { createDestruction, destroy } from "../../../src/runtime/destroy"

// 等待 Promise.then 微任务队列清空
// Flush the microtask queue so promise callbacks run
const flushMicrotasks = async () => {
    await Promise.resolve()
}

let instance!: any
let parent!: ReturnType<typeof createDestruction>

beforeEach(() => {
    instance = {
        _internal: {
            d: (parent = createDestruction(null))
        }
    } as any
    setCurrentInstance(instance)
})

afterEach(() => {
    destroy(parent, false)
    setCurrentInstance(null as any)
})

test("renders a synchronous component function directly", () => {
    const spy = vi.fn()
    const anchor = {} as any
    const context = { a: ["scope"] }
    renderComponent((a: any, c: any) => spy(a, c), anchor, context)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(anchor, context)
})

test("renders a thenable resolving to a component function", async () => {
    const spy = vi.fn()
    const anchor = {} as any
    const context = { a: ["scope"] }
    renderComponent(
        Promise.resolve((a: any, c: any) => spy(a, c)),
        anchor,
        context
    )
    expect(spy).not.toHaveBeenCalled()
    await flushMicrotasks()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(anchor, context)
})

test("renders a thenable resolving to a module with a default component function", async () => {
    const anchor = {} as any
    const context = { a: ["scope"] }
    const spy = vi.fn()
    renderComponent(Promise.resolve({ default: (a: any, c: any) => spy(a, c) }), anchor, context)
    await flushMicrotasks()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(anchor, context)
})

test("throws CannotRenderComponent for a synchronous non-renderable value", () => {
    expect(() => renderComponent(42 as any, {} as any, {})).toThrow(/2007/)
})

test("throws CannotRenderComponent when a thenable resolves to a non-renderable value", async () => {
    const anchor = {} as any
    const caught = new Promise<Error | null>(resolve => {
        const onUnhandled = (err: any) => {
            process.removeListener("unhandledRejection", onUnhandled)
            clearTimeout(timer)
            resolve(err)
        }
        const timer = setTimeout(() => {
            process.removeListener("unhandledRejection", onUnhandled)
            resolve(null)
        }, 20)
        process.on("unhandledRejection", onUnhandled)
        renderComponent(Promise.resolve({ notComponent: true }), anchor, {})
    })
    const err = await caught
    expect(err).not.toBeNull()
    expect(String(err)).toContain("2007")
})

test("skips rendering when the parent component is destroyed before resolve", async () => {
    const spy = vi.fn()
    const anchor = {} as any
    const context = { a: ["scope"] }
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    renderComponent(
        Promise.resolve((a: any, c: any) => spy(a, c)),
        anchor,
        context
    )
    destroy(parent, false)
    await flushMicrotasks()
    expect(spy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
})
