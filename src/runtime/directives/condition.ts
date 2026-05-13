import type { Destruction } from "#type-declarations/runtime"
import type { ArbitraryFunc } from "#type-declarations/tools"

import { UNDEF } from "../constants"
import { destroy } from "../destroy"
import { invokeRender } from "./render"
import { currentInstance } from "../state"
import { renderEffect } from "../reactivity/effect"

// crs: Conditions and Renders
export function conditionBlock(crs: ArbitraryFunc[]) {
    let renderIndex = -1
    let destruction: Destruction | undefined

    const crsCount = crs.length
    const hasElse = crsCount % 2
    const componentInstance = currentInstance!

    renderEffect(() => {
        for (let i = 0; i < crsCount; i += 2) {
            const isElse = hasElse && i === crsCount - 1
            if (!isElse && !crs[i]()) {
                continue
            }
            if (i != renderIndex) {
                renderIndex = i

                if (destruction) {
                    destroy(destruction)
                }
                destruction = invokeRender(crs[i + +!isElse], componentInstance)
            }
            return
        }
        if (destruction) {
            renderIndex = -1
            destroy(destruction)
            destruction = UNDEF
        }
    })
}
