import type { ArbitraryFunc } from "#type-declarations/tools"

import {
    DOCUMENT,
    KEY_ALT,
    KEY_META,
    KEY_CTRL,
    KEY_SHIFT,
    KEY_EXACT,
    KEY_FLAG_MAP,
    EVENT_ONCE,
    EVENT_SELF,
    EVENT_STOP,
    EVENT_CAPTURE,
    EVENT_PREVENT,
    EVENT_PASSIVE
} from "./constants"
import { getNodeContext } from "./dom"
import { eventRegisterInfo } from "./state"
import { any, len } from "../util/shared/sundry"
import { pushDestructionCleaner } from "./destroy"
import { isUndefined } from "../util/shared/assert"
import { call, defineProperties } from "../util/shared/aliases"

// 包装带有键位标志的事件
// Wrap events with key flags.
export function createEventWrapper(fn: ArbitraryFunc, flag: number) {
    return function (this: EventTarget, event: KeyboardEvent) {
        let checkRes: boolean | undefined = true
        if (event.type.startsWith("key")) {
            checkRes = !!(flag && any(KEY_FLAG_MAP)[event.key])
        }
        if (!checkRes) {
            return
        }

        const pairs: [number, boolean][] = [
            [flag & KEY_ALT, event.altKey],
            [flag & KEY_META, event.metaKey],
            [flag & KEY_CTRL, event.ctrlKey],
            [flag & KEY_SHIFT, event.shiftKey]
        ]
        for (const pair of pairs) {
            if (!checkRes) {
                break
            }
            if (pair[0]) {
                checkRes = pair[1]
            } else if (flag & KEY_EXACT) {
                checkRes = !pair[1]
            }
        }
        checkRes && call(fn, this, event)
    }
}

// 在根节点注册原生事件监听器，不同的 passive 属性独立注册（同类型只注册一个）
// Register native event listeners on the root node, registering separately
// for different `passive` option (only one will be registered for per type)
export function registerEvents(registration: string[]) {
    for (let i = 0, passive = false; i < len(registration); i++) {
        const registeIndex = +!passive
        const eventName = registration[i]
        if (isUndefined(eventName)) {
            passive = true
            continue
        }
        if (eventRegisterInfo[eventName][registeIndex]) {
            continue
        }
        DOCUMENT!.addEventListener(
            eventName,
            event => {
                dispatch(event, passive)
            },
            {
                passive,
                capture: true
            }
        )
        eventRegisterInfo[eventName][registeIndex] = true
    }
}

export function listen(elem: HTMLElement, type: string, handler: ArbitraryFunc, flag = 0) {
    const capture = !!(flag & EVENT_CAPTURE)
    const wrappedHandler = function (this: EventTarget, event: Event) {
        if (flag & EVENT_SELF && event.target !== elem) {
            return
        }
        if ((call(handler, this, event), flag & EVENT_STOP)) {
            event.stopPropagation()
        }
        if (flag & EVENT_PREVENT) {
            event.preventDefault()
        }
    }
    elem.addEventListener(type, wrappedHandler, {
        capture,
        once: !!(flag & EVENT_ONCE),
        passive: !!(flag & EVENT_PASSIVE)
    })
    pushDestructionCleaner(() => {
        elem.removeEventListener(type, wrappedHandler, capture)
    })
}

export function delegate(elem: any, type: string, handler: ArbitraryFunc, flag?: number) {
    getNodeContext(elem).e[type] = [handler, flag]
}

function dispatch(event: Event, passive: boolean) {
    const type = event.type
    const bubblings: [EventTarget, number][] = []
    const path = event.composedPath().slice(0, -4)

    const excuteEventHandler = (elem: EventTarget) => {
        const delegatedEvents = getNodeContext(elem).e
        const delegateEvent = delegatedEvents[type]
        const flag = delegateEvent[1] ?? 0
        if (flag & EVENT_PREVENT) {
            event.preventDefault()
        }
        if (flag & EVENT_ONCE) {
            delete delegatedEvents[type]
        }
        defineProperties(event, {
            currentTarget: {
                get() {
                    return elem
                }
            },
            eventPhase: {
                get() {
                    if (elem === event.target) {
                        return Event.AT_TARGET
                    }
                    if (flag & EVENT_CAPTURE) {
                        return Event.CAPTURING_PHASE
                    }
                    return Event.BUBBLING_PHASE
                }
            }
        })
        call(delegateEvent[0], elem, event)
    }

    for (let i = len(path) - 1; i >= 0; i--) {
        const elem = any(path[i])
        const delegateEvent = getNodeContext(elem).e[type]
        if (!delegateEvent) {
            continue
        }

        const flag = delegateEvent[1] ?? 0
        if (!!(flag & EVENT_PASSIVE) != passive) {
            continue
        }

        const isTarget = elem === event.target
        if (flag & EVENT_SELF && !isTarget) {
            continue
        }
        if (!isTarget && !(flag & EVENT_CAPTURE)) {
            bubblings.push([elem, flag])
            continue
        }
        if ((excuteEventHandler(elem), flag & EVENT_STOP)) {
            break
        }
    }
    for (const [elem, flag] of bubblings) {
        if ((excuteEventHandler(elem), flag & EVENT_STOP)) {
            break
        }
    }
}
