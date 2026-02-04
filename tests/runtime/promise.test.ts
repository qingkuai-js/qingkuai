import { expect, test, vi } from "vitest"
import { sleep } from "../../src/util/testing/sundry"
import { isFunction } from "../../src/util/shared/assert"
import { makeCancelablePromise } from "../../src/runtime/directives/promise"

test("Functions of cancelable promise", async () => {
    const invokeMarker = vi.fn()
    const pms1 = makeCancelablePromise(
        new Promise(resolve => {
            resolve(null)
        })
    )
    await pms1.then(res => {
        invokeMarker()
        expect(res).toBeNull()
    })
    expect(isFunction(pms1.then)).toBeTruthy()
    expect(isFunction(pms1.catch)).toBeTruthy()
    expect(isFunction(pms1.cancel)).toBeTruthy()
    expect(invokeMarker).toHaveBeenCalledTimes(1)

    const pms2 = makeCancelablePromise(
        new Promise((_, reject) => {
            reject("pms2")
        })
    )
    await pms2.catch(err => {
        invokeMarker()
        expect(err).toBe("pms2")
    })
    expect(invokeMarker).toHaveBeenCalledTimes(2)

    const pms3 = makeCancelablePromise(
        new Promise(resolve => {
            resolve(undefined)
        })
    )
    pms3.cancel()
    pms3.then(() => {
        invokeMarker()
    })

    await sleep(100)
    expect(invokeMarker).toHaveBeenCalledTimes(2)
})

test("Whether passing a non-promise argument will cause error", () => {
    for (const value of [1, undefined, null, {}, () => {}, Symbol()] as any[]) {
        expect(() => makeCancelablePromise(value)).toThrow(
            `The given value for "#await" directive is not a Promise. (2001)`
        )
    }
})
