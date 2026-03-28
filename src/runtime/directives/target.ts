import type { ArbitraryFunc, Getter } from "#type-declarations/tools"

import { renderEffect } from "../reactivity/effect"
import { appendChild, selectElement } from "../dom"
import { isElement } from "../../util/runtime/assert"
import { InvalidElementNode } from "../messages/error"
import { isNull, isString } from "../../util/shared/assert"
import { invokeRender, walkNodes } from "../../util/runtime/sundry"

export function targetBlock(anchor: Text, getValue: Getter, render: ArbitraryFunc) {
    let oldTarget: any = anchor
    const destruction = invokeRender(render)
    renderEffect(() => {
        let newTarget: any
        const value = getValue()
        if (isString(value)) {
            newTarget = selectElement(value)
        } else {
            newTarget = isNull(value) ? anchor : value
        }
        if (newTarget !== anchor && !isElement(newTarget)) {
            InvalidElementNode(`"#target" directive`)
        }
        if (newTarget !== oldTarget) {
            walkNodes(destruction, node => {
                appendChild(newTarget, node)
            })
        }
        oldTarget = newTarget
    })
}
