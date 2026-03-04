import type { Destruction } from "#type-declarations/runtime"
import type { ArbitraryFunc } from "#type-declarations/tools"

import { destroy } from "../destroy"
import { len } from "../../util/shared/sundry"
import { renderEffect } from "../reactivity/effect"
import { invokeRender } from "../../util/runtime/sundry"

// crs: Conditions and Renders
export function conditionBlock(crs: ArbitraryFunc[]) {
    let renderIndex: number | undefined
    let destruction: Destruction | undefined
    const crsCount = len(crs)
    const hasElse = crsCount % 2
    renderEffect(() => {
        for (let i = 0; i < crsCount; i += 2) {
            const isElse = hasElse && i === crsCount - 1
            if (!isElse && !crs[i]()) {
                continue
            }
            if (i != renderIndex) {
                renderIndex = i
                destruction && destroy(destruction)
                destruction = invokeRender(crs[i + +!isElse])
            }
            return
        }
        destruction && destroy(destruction)
    })
}
