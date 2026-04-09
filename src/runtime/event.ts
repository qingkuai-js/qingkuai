import type { ArbitraryFunc } from "#type-declarations/tools"

import {
    KEY_ALT,
    KEY_META,
    KEY_CTRL,
    KEY_SHIFT,
    KEY_EXACT,
    EVENT_ONCE,
    EVENT_SELF,
    EVENT_STOP,
    EVENT_CAPTURE,
    EVENT_PREVENT,
    EVENT_PASSIVE
} from "../util/shared/flags"
import { eventRegisterInfo } from "./state"
import { call } from "../util/shared/aliases"
import { pushDestructionCleaner } from "./destroy"
import { isUndefined } from "../util/shared/assert"
import { any, createProxy } from "../util/shared/sundry"
import { DELEGATE_PREFIX, DOCUMENT, EVENT_FLAG, KEY_FLAG_MAP } from "./constants"

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
        if (checkRes) {
            call(fn, this, event)
        }
    }
}

// 在根节点注册原生事件监听器，不同的 passive 属性独立注册（同类型只注册一个）
// Register native event listeners on the root node, registering separately
// for different `passive` option (only one will be registered for per type)
export function registerEvents(registration: string[]) {
    for (let i = 0, passive = false; i < registration.length; i++) {
        const registeIndex = +!passive
        const eventName = registration[i]
        if (isUndefined(eventName)) {
            passive = true
            continue
        }
        if ((eventRegisterInfo[eventName] ??= [])[registeIndex]) {
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
    if (flag) {
        any(elem)[EVENT_FLAG + type] = flag
    }
    any(elem)[DELEGATE_PREFIX + type] = handler
}

function dispatch(event: Event, passive: boolean) {
    const flagKey = EVENT_FLAG + event.type
    const bubblings: [EventTarget, number][] = []
    const path = event.composedPath().slice(0, -4)
    const handlerKey = DELEGATE_PREFIX + event.type

    const excuteEventHandler = (elem: EventTarget) => {
        const handler = any(elem)[handlerKey]
        const flag = any(elem)[flagKey] ?? 0
        if (flag & EVENT_PREVENT) {
            event.preventDefault()
        }
        if (flag & EVENT_ONCE) {
            delete any(elem)[flagKey]
            delete any(elem)[handlerKey]
        }
        const proxiedEvent = createProxy(event, {
            get(target, property: keyof Event) {
                if (property === "currentTarget") {
                    return elem
                }
                if (property === "eventPhase") {
                    if (elem === event.target) {
                        return Event.AT_TARGET
                    }
                    if (flag & EVENT_CAPTURE) {
                        return Event.CAPTURING_PHASE
                    }
                    return Event.BUBBLING_PHASE
                }
                return target[property]
            }
        })
        call(handler, elem, proxiedEvent)
    }

    for (let i = path.length - 1; i >= 0; i--) {
        const elem = any(path[i])
        const handler = elem[handlerKey]
        if (!handler) {
            continue
        }

        const flag = elem[flagKey] ?? 0
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
