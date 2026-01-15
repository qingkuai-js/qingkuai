import type { ArbitraryFunc, Getter } from "#type-declarations/tools"

import { createDestruction } from "../destroy"
import { renderEffect } from "../reactivity/effect"
import { isElement } from "../../util/runtime/assert"
import { walkNodes } from "../../util/runtime/sundry"
import { InvalidElementNode } from "../messages/error"
import { isNull, isString } from "../../util/shared/assert"
import { appendChild, insertBefore, selectElement } from "../dom"

export function targetBlock(anchor: Text, getValue: Getter, render: ArbitraryFunc) {
    let oldTarget: any = anchor
    const destruction = createDestruction()

    render()
    renderEffect(() => {
        let newTarget: any
        const value = getValue()
        if (isString(value)) {
            newTarget = selectElement(value)
        } else {
            newTarget = isNull(value) ? anchor : value
        }
        if (newTarget !== anchor && !isElement(newTarget)) {
            InvalidElementNode("#target directive")
        }
        if (newTarget !== oldTarget) {
            walkNodes(destruction, node => {
                if (newTarget === anchor) {
                    insertBefore(anchor, node)
                } else {
                    appendChild(newTarget, node)
                }
            })
        }
        oldTarget = newTarget
    })
}
