import type { Destruction } from "#type-declarations/runtime"
import type { ArbitraryFunc, Getter } from "#type-declarations/tools"

import { NIL } from "../constants"
import { invokeRender } from "./render"
import { renderEffect } from "../reactivity/effect"
import { walkNodes } from "../../util/runtime/sundry"
import { isElement } from "../../util/runtime/assert"
import { InvalidElementNode } from "../messages/error"
import { isNull, isString } from "../../util/shared/assert"
import { currentDestruction, currentInstance } from "../state"
import { appendChild, insertBefore, selectElement } from "../dom"

export function targetBlock(anchor: Text, getValue: Getter, render: ArbitraryFunc) {
    let oldTarget: any = anchor
    const destruction = invokeRender(render, currentInstance!, currentDestruction)
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
            walkTargetNodes(destruction, node => {
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

function walkTargetNodes(destruction: Destruction, callback: (node: ChildNode) => void) {
    if ((walkNodes(destruction, callback), destruction.c)) {
        for (const child of destruction.c) {
            walkTargetNodes(child, callback)
        }
    }
}
