import type { ArbitraryFunc, Getter } from "#type-declarations/tools"
import type { CancelablePromise, Destruction } from "#type-declarations/runtime"

import { NIL } from "../constants"
import { invokeRender } from "./render"
import { NotPromise } from "../messages/error"
import { renderEffect } from "../reactivity/effect"
import { isPromise } from "../../util/shared/assert"
import { objectAssign } from "../../util/shared/aliases"
import { destroy, pushDestructionCleaner } from "../destroy"
import { currentDestruction, currentInstance } from "../state"
import { CANCELABLE, PROMISE_PENDING, PROMISE_SETTLED } from "./constants"

export function promiseBlock(
    getValue: Getter,
    renderPending: ArbitraryFunc | undefined,
    renderThen: ArbitraryFunc | undefined,
    renderCatch: ArbitraryFunc | undefined
) {
    let state: number
    let pms: CancelablePromise | null
    let destruction: Destruction | null
    const componentInstance = currentInstance!
    const parentDestruction = currentDestruction

    // 待办：添加端到端测试
    // TODO: Add end-to-end tests
    pushDestructionCleaner(() => {
        pms?.cancel()
    })

    const changeState = (newState: number, render: ArbitraryFunc | undefined, arg?: any) => {
        if (destruction) {
            destroy(destruction)
        }
        state = newState
        destruction = NIL

        if (render) {
            destruction = invokeRender(() => render(arg), componentInstance, parentDestruction)
        }
    }

    renderEffect(() => {
        if (state === PROMISE_PENDING) {
            pms?.cancel()
        } else {
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
        NotPromise(`"#await" directive`)
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
