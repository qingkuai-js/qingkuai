import type { GeneralFunc } from "#type-declarations/tools"
import type { ComponentContext } from "#type-declarations/runtime"

import { invokeRender } from "./render"
import { currentInstance } from "../state"

export function renderSlot(
    context: ComponentContext,
    name: string,
    anchor: ChildNode,
    props?: Record<string, any>,
    fallback?: GeneralFunc
) {
    const slot = context.s?.[name]
    const componentInstance = currentInstance!
    if (!slot) {
        if (fallback) {
            invokeRender(fallback, componentInstance)
        }
    } else {
        invokeRender(() => slot(anchor, props), componentInstance)
    }
}
