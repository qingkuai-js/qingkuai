import type { ArbitraryFunc, Getter } from "#type-declarations/tools";

import { DEV_MODE } from "../constants";
import { invokeRender } from "./render";
import { renderEffect } from "../reactivity/effect";
import { isElement } from "../../util/runtime/assert";
import { walkNodes } from "../../util/runtime/sundry";
import { InvalidElementNode } from "../messages/error";
import { TargetNamespaceMismatch } from "../messages/warn";
import { isNull, isString } from "../../util/shared/assert";
import { currentDestruction, currentInstance } from "../state";
import { appendChild, insertBefore, selectElement } from "../dom";

export function targetBlock(anchor: Text, getValue: Getter, render: ArbitraryFunc) {
    let warned = false;
    let oldTarget: any = anchor;
    const destruction = invokeRender(render, currentInstance!, currentDestruction);
    renderEffect(() => {
        let newTarget: any;
        const value = getValue();
        if (isString(value)) {
            newTarget = selectElement(value);
        } else {
            newTarget = isNull(value) ? anchor : value;
        }
        if (newTarget !== anchor && !isElement(newTarget)) {
            InvalidElementNode(`"#target" directive`);
        }
        if (newTarget !== oldTarget) {
            walkNodes(destruction, node => {
                if (newTarget === anchor) {
                    insertBefore(anchor, node);
                } else {
                    // 搬迁不改变节点命名空间，跨命名空间的节点不会被渲染
                    // Moving does not convert nodes, so nodes moved
                    // across namespaces will not render.
                    if (
                        DEV_MODE &&
                        !warned &&
                        isElement(node) &&
                        node.namespaceURI !== newTarget.namespaceURI
                    ) {
                        warned = true;
                        TargetNamespaceMismatch(newTarget);
                    }
                    appendChild(newTarget, node);
                }
            });
        }
        oldTarget = newTarget;
    });
}
