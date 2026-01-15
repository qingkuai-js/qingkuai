import type { ArbitraryFunc, Getter } from "#type-declarations/tools"
import type { CancelablePromise, Destruction } from "#type-declarations/runtime"

import { NIL } from "../constants"
import { NotPromise } from "../messages/error"
import { renderEffect } from "../reactivity/effect"
import { isPromise } from "../../util/shared/assert"
import { createDestruction, destroy } from "../destroy"
import { objectAssign } from "../../util/shared/aliases"
import { CANCELABLE, PROMISE_PENDING, PROMISE_SETTLED } from "./constants"

export function promiseBlock(
    getValue: Getter,
    renderPending: ArbitraryFunc | null,
    renderThen: ArbitraryFunc | null,
    renderCatch: ArbitraryFunc | null
) {
    let state: number
    let pms: CancelablePromise | null
    let destruction: Destruction | null

    const changeState = (newState: number, render: ArbitraryFunc | null, arg?: any) => {
        destruction && destroy(destruction)
        destruction = NIL
        state = newState

        if (render) {
            destruction = createDestruction()
            render(arg)
        }
    }

    renderEffect(() => {
        if (state != PROMISE_PENDING) {
            pms && pms.cancel()
            changeState(PROMISE_PENDING, renderPending)
        }
        ;(pms = makeCancelablePromise(getValue())).then(
            result => {
                changeState(PROMISE_SETTLED, renderThen, result)
            },
            reason => {
                changeState(PROMISE_SETTLED, renderCatch, reason)
            }
        )
    })
}

// 创建可取消的 Promise 包装器
// Create a cancelable Promise wrapper
export function makeCancelablePromise(pms: any): CancelablePromise {
    if (pms?.[CANCELABLE]) {
        return pms
    }
    if (!isPromise(pms)) {
        NotPromise("#await directive")
    }

    let isCanceled = false
    const ret = new Promise((resolve, reject) => {
        ;(pms as Promise<any>).then(
            res => {
                if (!isCanceled) {
                    resolve(res)
                }
            },
            err => {
                if (!isCanceled) {
                    reject(err)
                }
            }
        )
    })
    return objectAssign(ret, {
        [CANCELABLE]: true,
        cancel: () => (isCanceled = true)
    })
}
