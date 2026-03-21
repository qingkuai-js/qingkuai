import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ComponentInstance, Destruction } from "#type-declarations/runtime"

import { runHooks } from "./component"
import { runAll } from "../util/shared/sundry"
import { walkNodes } from "../util/runtime/sundry"
import { disposeEffect } from "./reactivity/effect"
import { AFTER_DESTROY, BEFORE_DESTROY, NIL } from "./constants"
import { currentDestruction, setCurrentDestruction } from "./state"

export function destroy(destruction: Destruction) {
    if (destruction.m) {
        runHooks(destruction.m, BEFORE_DESTROY)
    }
    if (destruction.l) {
        runAll(destruction.l)
    }
    if (destruction.c) {
        for (const child of destruction.c) {
            destroy(child)
        }
    }
    if (destruction.e) {
        for (const effect of destruction.e) {
            disposeEffect(effect, true)
        }
    }
    if (destruction.p) {
        destruction.p.c?.delete(destruction)
    }
    walkNodes(destruction, node => node.remove())

    if (destruction.m) {
        runHooks(destruction.m, AFTER_DESTROY)
    }
}

export function pushDestructionCleaner(cleaner: ArbitraryFunc) {
    if (!currentDestruction) {
        return
    }
    if (!currentDestruction.l) {
        currentDestruction.l = []
    }
    currentDestruction.l.push(cleaner)
}

export function createDestruction(instance: ComponentInstance | null = NIL) {
    const destruction: Destruction = {
        e: NIL,
        c: NIL,
        l: NIL,
        m: instance,
        n: [NIL, NIL],
        p: currentDestruction
    }
    if (currentDestruction) {
        if (currentDestruction.c) {
            currentDestruction.c.add(destruction)
        } else {
            currentDestruction.c = new Set([destruction])
        }
    }
    return setCurrentDestruction(destruction)!
}
