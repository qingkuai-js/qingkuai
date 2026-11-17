import type { ArbitraryFunc } from "#type-declarations/tools";
import type { ComponentInstanceBase, Destruction } from "#type-declarations/runtime";

import { runHooks } from "./component";
import { isArray } from "../util/shared/assert";
import { walkNodes } from "../util/runtime/sundry";
import { swapDelete } from "../util/shared/arrays";
import { disposeEffect } from "./reactivity/effect";
import { ErrorThrownDuringDestruction } from "./messages/warn";
import { currentDestruction, setCurrentDestruction } from "./state";
import { DEV_MODE, AFTER_DESTROY, BEFORE_DESTROY, NIL } from "./constants";
import { DST_DESTRUCTED, DST_ORPHAN_CONTENT, DST_WITH_TARGET } from "../util/shared/flags";

export function pushDestructionCleaner(cleaner: ArbitraryFunc) {
    if (!currentDestruction) {
        return;
    }
    (currentDestruction.a ??= []).push(cleaner);
}

export function createDestruction(
    parentDestruction: Destruction | null,
    instance: ComponentInstanceBase | null = NIL,
) {
    const destruction: Destruction = {
        l: 0,
        i: -1,
        e: NIL,
        c: NIL,
        a: NIL,
        s: NIL,
        n: NIL,
        m: instance,
        p: parentDestruction,
    };
    if (parentDestruction) {
        const children = (parentDestruction.c ??= []);
        destruction.i = children.length;
        children.push(destruction);
    }
    return setCurrentDestruction(destruction)!;
}

export function destroy(destruction: Destruction, detachNodes = true, detachFromParent = true) {
    let firstError: unknown;
    let effects = destruction.e;
    const cleaners = destruction.a;
    const children = destruction.c;
    const instance = destruction.m;
    const isComponentOwned = instance?._internal.d === destruction;
    if (isComponentOwned) {
        try {
            runHooks(instance, BEFORE_DESTROY);
        } catch (err) {
            firstError ??= err;
        }
    }
    if (cleaners) {
        for (let i = 0; i < cleaners.length; i++) {
            try {
                cleaners[i]();
            } catch (err) {
                firstError ??= err;
            }
        }
    }
    if (children) {
        const childDetach = detachNodes && !destruction.s;
        for (let i = 0; i < children.length; i++) {
            const hasTargetDirective = !!(children[i].l & DST_WITH_TARGET);
            destroy(children[i], childDetach || hasTargetDirective, false);
        }
    }
    if (effects) {
        if (!isArray(effects)) {
            effects = [effects];
        }
        for (let i = 0; i < effects.length; i++) {
            try {
                disposeEffect(effects[i], true);
            } catch (err) {
                firstError ??= err;
            }
        }
    }
    if (detachFromParent && destruction.p?.c) {
        const siblings = destruction.p.c;
        if (destruction.i >= 0 && destruction.i < siblings.length) {
            swapDelete(siblings, destruction.i);
            if (destruction.i < siblings.length) {
                siblings[destruction.i].i = destruction.i;
            }
        }
        destruction.i = -1;
    }
    if (detachNodes && destruction.s && destruction.n) {
        if (destruction.l & DST_ORPHAN_CONTENT) {
            destruction.s.remove();
        } else {
            walkNodes(destruction, node => node.remove());
        }
    }
    try {
        if (isComponentOwned) {
            runHooks(instance, AFTER_DESTROY);
        }
    } catch (err) {
        firstError ??= err;
    }
    if (firstError && DEV_MODE) {
        ErrorThrownDuringDestruction(firstError);
    }
    destruction.l |= DST_DESTRUCTED;
    destruction.c = destruction.a = destruction.e = NIL;
    destruction.s = destruction.n = destruction.m = destruction.p = NIL;
}
