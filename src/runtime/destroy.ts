import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ComponentInstanceBase, Destruction } from "#type-declarations/runtime"

import { runHooks } from "./component"
import { runAll } from "../util/shared/sundry"
import { walkNodes } from "../util/runtime/sundry"
import { disposeEffect } from "./reactivity/effect"
import { spliceByElem } from "../util/shared/arrays"
import { AFTER_DESTROY, BEFORE_DESTROY, NIL } from "./constants"
import { currentDestruction, setCurrentDestruction } from "./state"
import { FRAG_ORPHAN_CONTENT, FRAG_WITH_TARGET } from "../util/shared/flags"

export function pushDestructionCleaner(cleaner: ArbitraryFunc) {
    if (!currentDestruction) {
        return
    }
    ;(currentDestruction.l ??= []).push(cleaner)
}

export function createDestruction(instance: ComponentInstanceBase | null = NIL) {
    const destruction: Destruction = {
        f: 0,
        e: NIL,
        c: NIL,
        l: NIL,
        s: NIL,
        n: NIL,
        m: instance,
        p: currentDestruction
    }
    if (currentDestruction) {
        ;(currentDestruction.c ??= []).push(destruction)
    }
    return setCurrentDestruction(destruction)!
}

export function destroy(destruction: Destruction, detachNodes = true, detachFromParent = true) {
    const effects = destruction.e
    const instance = destruction.m
    const cleaners = destruction.l
    const children = destruction.c
    if (instance) {
        runHooks(instance, BEFORE_DESTROY)
    }
    if (cleaners) {
        runAll(cleaners)
    }
    if (children) {
        const childDetach = detachNodes && !destruction.s
        for (let i = 0; i < children.length; i++) {
            const hasTargetDirective = !!(children[i].f & FRAG_WITH_TARGET)
            destroy(children[i], childDetach || hasTargetDirective, false)
        }
    }
    if (effects) {
        for (let i = 0; i < effects.length; i++) {
            disposeEffect(effects[i], true)
        }
    }
    if (detachFromParent && destruction.p?.c) {
        spliceByElem(destruction.p.c, destruction, false)
    }
    if (detachNodes && destruction.s && destruction.n) {
        if (destruction.f & FRAG_ORPHAN_CONTENT) {
            destruction.s.remove()
        } else {
            walkNodes(destruction, node => node.remove())
        }
    }
    if (instance) {
        runHooks(instance, AFTER_DESTROY)
    }
    destruction.c = destruction.l = destruction.e = NIL
    destruction.s = destruction.n = destruction.m = destruction.p = NIL
}
