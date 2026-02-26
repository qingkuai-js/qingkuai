import type { ArbitraryFunc, Getter } from "#type-declarations/tools"

import { any } from "../../util/shared/sundry"
import { getNodeContext, setText } from "../dom"
import { renderEffect } from "../reactivity/effect"
import { invokeRender, walkNodes } from "../../util/runtime/sundry"

export function displayBlock(getValue: Getter, render: ArbitraryFunc) {
    let oldShouldDisplay = true
    const destruction = invokeRender(render)
    renderEffect(() => {
        const newShouldDisplay = !!getValue()
        if (newShouldDisplay != oldShouldDisplay) {
            walkNodes(destruction, node => {
                if (node.nodeType === 3) {
                    const context = getNodeContext(node)
                    context.a.d /** display */ = newShouldDisplay
                    if (newShouldDisplay) {
                        setText(node as Text, context.a.v)
                    } else if ((context.a.v /** value */ = node.nodeValue)?.trim()) {
                        node.nodeValue = ""
                    }
                } else if ("style" in node) {
                    any(node.style).display = newShouldDisplay ? "" : "none"
                }
            })
        }
        oldShouldDisplay = newShouldDisplay
    })
}
