import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ComponentInstance, Destruction } from "#type-declarations/runtime"

import { runHooks } from "./component"
import { runAll } from "../util/shared/sundry"
import { disposeEffect } from "./reactivity/effect"
import { spliceByElem } from "../util/shared/arrays"
import { FRAG_ORPHAN_CONTENT } from "../util/shared/flags"
import { currentDestruction, setCurrentDestruction } from "./state"
import { AFTER_DESTROY, BEFORE_DESTROY, FRAGMENT_FLAG, NIL } from "./constants"

export function pushDestructionCleaner(cleaner: ArbitraryFunc) {
    if (!currentDestruction) {
        return
    }
    ;(currentDestruction.l ??= []).push(cleaner)
}

export function createDestruction(instance: ComponentInstance | null = NIL) {
    const destruction: Destruction = {
        e: NIL,
        c: NIL,
        l: NIL,
        r: NIL,
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
        for (let i = 0; i < children.length; i++) {
            destroy(children[i], detachNodes, false)
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
    if (destruction.r && detachNodes) {
        if ((destruction.r as any)[FRAGMENT_FLAG] & FRAG_ORPHAN_CONTENT) {
            ;(destruction.r as ChildNode).remove()
        } else {
            const root = destruction.r as DocumentFragment
            for (let node = root.firstChild; node; node = root.firstChild) {
                node.remove()
            }
        }
    }
    if (instance) {
        runHooks(instance, AFTER_DESTROY)
    }
    destruction.c = destruction.l = destruction.e = NIL
    destruction.r = destruction.m = destruction.p = NIL
}
