import type { GeneralFunc } from "#type-declarations/tools"
import type { ComponentContext } from "#type-declarations/runtime"

import { invokeRender } from "./render"
import { currentDestruction, currentInstance } from "../state"

export function renderSlot(
    context: ComponentContext,
    name: string,
    anchor: ChildNode,
    props?: Record<string, any>,
    fallback?: GeneralFunc
) {
    const slot = context.s?.[name]
    const componentInstance = currentInstance!
    const parentDestruction = currentDestruction
    if (!slot) {
        if (fallback) {
            invokeRender(fallback, componentInstance, parentDestruction)
        }
    } else {
        invokeRender(() => slot(anchor, props), componentInstance, parentDestruction)
    }
}
