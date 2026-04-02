import type { Destruction } from "#type-declarations/runtime"
import type { ArbitraryFunc } from "#type-declarations/tools"

import { destroy } from "../destroy"
import { renderEffect } from "../reactivity/effect"
import { invokeRender } from "../../util/runtime/sundry"

// crs: Conditions and Renders
export function conditionBlock(crs: ArbitraryFunc[]) {
    let renderIndex = -1
    let destruction: Destruction | undefined
    const crsCount = crs.length
    const hasElse = crsCount % 2
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
                destruction = invokeRender(crs[i + +!isElse])
            }
            return
        }
        if (destruction) {
            renderIndex = -1
            destroy(destruction)
        }
    })
}
