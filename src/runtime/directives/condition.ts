import type { Destruction } from "#type-declarations/runtime"
import type { ArbitraryFunc } from "#type-declarations/tools"

import { len } from "../../util/shared/sundry"
import { renderEffect } from "../reactivity/effect"
import { createDestruction, destroy } from "../destroy"

// crs: Conditions and Renders
export function conditionBlock(crs: ArbitraryFunc[]) {
    let renderIndex: number | undefined
    let destruction: Destruction | undefined
    renderEffect(() => {
        for (let i = 0; i < len(crs); i += 2) {
            if (!crs[i]()) {
                continue
            }
            if (i != renderIndex) {
                destruction && destroy(destruction)
                destruction = createDestruction()
                renderIndex = i
                crs[i + 1]()
            }
            return
        }
        destruction && destroy(destruction)
    })
}
