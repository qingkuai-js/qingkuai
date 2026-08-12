import type { Destruction } from "#type-declarations/runtime"
import type { ArbitraryFunc, Getter } from "#type-declarations/tools"

import { invokeRender } from "./render"
import { renderEffect } from "../reactivity/effect"
import { isElement } from "../../util/runtime/assert"
import { walkNodes } from "../../util/runtime/sundry"
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

// 遍历 destruction 树的所有 DOM 节点。destruction 若自身有 s/n 范围（渲染了完整
// DOM，如普通元素/组件根片段），遍历自身即可，其子块的节点都包含在该范围内，故
// 不再递归 children——否则会把嵌套 target 已移走的节点或组件内部节点错误地再次移动。
// 只有纯容器 destruction（无 s/n，如 #target 包裹 renderComponent、#await 块）才需
// 递归 children 找到真正的节点。
// Visit every DOM node owned by the destruction tree. When a destruction owns an
// s/n range (a plain element or component root fragment), walking it covers all
// nested nodes, so children are NOT recursed — recursing would wrongly re-move
// nodes already teleported by a nested #target or lift component nodes out of their
// container. Only container destructions (no s/n, e.g. #target wrapping
// renderComponent or #await blocks) recurse into children to find the real nodes.
function walkTargetNodes(destruction: Destruction, callback: (node: ChildNode) => void) {
    if (destruction.s && destruction.n) {
        walkNodes(destruction, callback)
    } else {
        for (const child of destruction.c || []) {
            walkTargetNodes(child, callback)
        }
    }
}
