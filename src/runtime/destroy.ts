import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ComponentInstance, Destruction } from "#type-declarations/runtime"

import { runHooks } from "./component"
import { runAll } from "../util/shared/sundry"
import { disposeEffect } from "./reactivity/effect"
import { spliceByElem } from "../util/shared/arrays"
import { FRAG_ORPHAN_CONTENT } from "../util/shared/flags"
import { AFTER_DESTROY, BEFORE_DESTROY, NIL } from "./constants"
import { currentDestruction, setCurrentDestruction } from "./state"

export function pushDestructionCleaner(cleaner: ArbitraryFunc) {
    if (!currentDestruction) {
        return
    }
    ;(currentDestruction.l ??= []).push(cleaner)
}

export function createDestruction(instance: ComponentInstance | null = NIL) {
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
    const instance = destruction.m
    const cleaners = destruction.l
    const children = destruction.c
    const effects = destruction.e
    if (instance) {
        runHooks(instance, BEFORE_DESTROY)
    }
    if (cleaners) {
        runAll(cleaners)
    }
    if (children) {
        const childDetach = detachNodes && !destruction.s
        for (let i = 0; i < children.length; i++) {
            destroy(children[i], childDetach, false)
        }
    }
    if (effects) {
        for (let i = 0; i < effects.length; i++) {
            disposeEffect(effects[i], true)
        }
    }
    if (destruction.p?.c && detachFromParent) {
        spliceByElem(destruction.p.c, destruction, false)
    }
    if (destruction.s && destruction.n && detachNodes) {
        if (destruction.f & FRAG_ORPHAN_CONTENT) {
            destruction.s.remove()
        } else {
            const range = new Range()
            range.setStartBefore(destruction.s)
            range.setEndAfter(destruction.n)
            range.deleteContents()
        }
    }
    if (instance) {
        runHooks(instance, AFTER_DESTROY)
    }
    destruction.f = 0
    destruction.c = destruction.l = destruction.e = NIL
    destruction.s = destruction.n = destruction.m = destruction.p = NIL
}
