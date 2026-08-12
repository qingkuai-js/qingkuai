import type { GeneralFunc } from "#type-declarations/tools"

import { invokeRender } from "./render"
import { currentDestruction, currentInstance } from "../state"

export function renderSlot(
    name: string,
    anchor: ChildNode,
    props?: Record<string, any>,
    fallback?: GeneralFunc
) {
    const componentInstance = currentInstance!
    const parentDestruction = currentDestruction
    const slot = componentInstance._internal.s?.[name]
    if (!slot) {
        if (fallback) {
            invokeRender(fallback, componentInstance, parentDestruction)
        }
    } else {
        invokeRender(() => slot(anchor, props), componentInstance, parentDestruction)
    }
}
