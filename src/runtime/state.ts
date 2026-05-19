import type { ComponentInstanceBase, Destruction } from "#type-declarations/runtime"

import { NIL } from "./constants"

export let currentDestruction: Destruction | null = NIL
export let currentInstance: ComponentInstanceBase | null = NIL

export const eventRegisterInfo: Record<string, boolean[]> = {}

export function backToParentDestruction() {
    if (!currentDestruction) {
        return
    }
    setCurrentDestruction(currentDestruction.p)
}

export function setCurrentDestruction(value: Destruction | null) {
    return (currentDestruction = value)
}

export function setCurrentInstance(value: ComponentInstanceBase | null) {
    return (currentInstance = value)
}
