import type { ArbitraryFunc } from "#type-declarations/tools"

import { isArray } from "../../util/shared/assert"

export function EffectOrWatchHasNoDependecies(fn: ArbitraryFunc, by: string) {
    warnWithCode(
        8001,
        `No reactive values were dependant during the execution of effect${
            by ? " that created with " + by : ""
        }. The effect has been destroyed because it will no longer be triggered in future. By: %O`,
        fn
    )
}

export function InvalidAssignment(target: string) {
    warnWithCode(
        8002,
        `An assignment to the ${target} is invalid, and this operation has been ignored.`
    )
}

export function LifecycleHookRegisteredAfterPhase(name: string) {
    warnWithCode(
        8004,
        `The lifecycle hook "${name}" was registered after its corresponding phase had already passed, so the callback will never be triggered. The registration has been ignored.`
    )
}

export function TargetNamespaceMismatch(target: Element) {
    warnWithCode(
        8005,
        `The "#target" directive moved nodes into an element of a different namespace. Moving does not convert nodes, so SVG nodes placed into HTML (and the reverse) will not render. Target: %O`,
        target
    )
}

export function CreateOnDisposedComponent(purpose: string) {
    warnWithCode(
        8003,
        `Attempted to create a ${purpose} after the owning component was destroyed. This usually means an async callback ran after the component was removed; the creation has been ignored.`
    )
}

function warnWithCode(code: number, message: any, ...args: any[]) {
    const payload = isArray(message) ? message : [message, ...args]
    console.warn(`[QingKuai Warning](${code}):`, ...payload)
}
