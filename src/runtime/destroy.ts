import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ComponentInstanceBase, Destruction } from "#type-declarations/runtime"

import { runHooks } from "./component"
import { runAll } from "../util/shared/sundry"
import { isArray } from "../util/shared/assert"
import { walkNodes } from "../util/runtime/sundry"
import { swapDelete } from "../util/shared/arrays"
import { disposeEffect } from "./reactivity/effect"
import { AFTER_DESTROY, BEFORE_DESTROY, NIL } from "./constants"
import { currentDestruction, setCurrentDestruction } from "./state"
import { FRAG_ORPHAN_CONTENT, FRAG_WITH_TARGET } from "../util/shared/flags"

export function pushDestructionCleaner(cleaner: ArbitraryFunc) {
    if (!currentDestruction) {
        return
    }
    ;(currentDestruction.a ??= []).push(cleaner)
}

export function createDestruction(
    parentDestruction: Destruction | null,
    instance: ComponentInstanceBase | null = NIL
) {
    const destruction: Destruction = {
        f: 0,
        i: -1,
        e: NIL,
        u: NIL,
        c: NIL,
        a: NIL,
        s: NIL,
        n: NIL,
        d: false,
        m: instance,
        p: parentDestruction
    }
    if (parentDestruction) {
        const children = (parentDestruction.c ??= [])
        destruction.i = children.length
        children.push(destruction)
    }
    return setCurrentDestruction(destruction)!
}

export function destroy(destruction: Destruction, detachNodes = true, detachFromParent = true) {
    const effects = destruction.e
    const cleaners = destruction.a
    const children = destruction.c
    const instance = destruction.m
    const isComponentOwned = instance?._internal.d === destruction
    if (isComponentOwned) {
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
        if (isArray(effects)) {
            for (let i = 0; i < effects.length; i++) {
                disposeEffect(effects[i], true)
            }
        } else {
            disposeEffect(effects, true)
        }
    }
    if (detachFromParent && destruction.p?.c) {
        const siblings = destruction.p.c
        if (destruction.i >= 0 && destruction.i < siblings.length) {
            swapDelete(siblings, destruction.i)
            if (destruction.i < siblings.length) {
                siblings[destruction.i].i = destruction.i
            }
        }
        destruction.i = -1
    }
    if (detachNodes && destruction.s && destruction.n) {
        if (destruction.f & FRAG_ORPHAN_CONTENT) {
            destruction.s.remove()
        } else {
            walkNodes(destruction, node => node.remove())
        }
    }
    if (isComponentOwned) {
        runHooks(instance, AFTER_DESTROY)
    }
    destruction.d = true
    destruction.c = destruction.a = destruction.e = destruction.u = NIL
    destruction.s = destruction.n = destruction.m = destruction.p = NIL
}
