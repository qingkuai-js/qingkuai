import type { FixedArray } from "#type-declarations/tools"
import type { ComponentInstance, Destruction } from "#type-declarations/runtime"

import { NIL } from "./constants"

export let currentDestruction: Destruction | null = NIL
export let currentInstance: ComponentInstance | null = NIL

export const aliasSetterToTarget = new WeakMap()
export const aliasTargetDescriptors = new WeakMap()
export const eventRegisterInfo: Record<string, FixedArray<boolean, 2>> = {}

export function backToParentDestruction() {
    if (!currentDestruction) {
        return
    }
    setCurrentDestruction(currentDestruction.p)
}

export function setCurrentDestruction(value: Destruction | null) {
    return (currentDestruction = value)
}

export function setCurrentInstance(value: ComponentInstance | null) {
    return (currentInstance = value)
}
