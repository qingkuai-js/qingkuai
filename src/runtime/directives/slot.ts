import type { GeneralFunc } from "#type-declarations/tools"
import type { ComponentContext } from "#type-declarations/runtime"

import { invokeRender } from "../../util/runtime/sundry"

export function renderSlot(
    context: ComponentContext,
    name: string,
    anchor: ChildNode,
    props?: Record<string, any>,
    fallback?: GeneralFunc
) {
    const slot = context.s?.[name]
    if (slot) {
        return invokeRender(() => {
            slot(anchor, props)
        })
    }
    if (fallback) {
        return invokeRender(fallback)
    }
}
