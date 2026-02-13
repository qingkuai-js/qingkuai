import type { Getter, Setter } from "#type-declarations/tools"
import type { DestructuringFunc } from "#type-declarations/runtime"

import { activeEffect } from "./state"
import { TOARRAY, UNDEF } from "../constants"
import { arrayFrom } from "../../util/shared/arrays"
import { InvalidAssignment } from "../messages/warn"
import { isUndefined } from "../../util/shared/assert"
import { EFFECT_DERIVED_DIRTY, EFFECT_DERIVED_READING } from "./constants"
import { appendLinksToActiveEffect, derivedEffect, runAndUpdateEffect } from "./effect"

export function destructuringDerived(
    dfn: DestructuringFunc,
    getter: Getter,
    valuesLen: number,
    debugSetters?: Setter[]
) {
    let initialized = false

    const ret: any[] = []
    const isDebugging = isUndefined(debugSetters)
    const targets = arrayFrom({ length: valuesLen }, () => ({ $: UNDEF }))

    const effect = derivedEffect(() => {
        const isReading = initialized && effect.l & EFFECT_DERIVED_READING
        if (isReading && effect.l & EFFECT_DERIVED_DIRTY) {
            const values = dfn(getter())
            for (let i = 0; i < valuesLen; i++) {
                targets[i].$ = values[i]
                debugSetters?.[i](values[i])
            }
        }
        if (initialized && !isReading) {
            effect.l |= EFFECT_DERIVED_DIRTY
        }
        initialized ||= true
    })

    for (let i = 0; i < valuesLen; i++) {
        const wrapper = {
            set $(_) {
                InvalidAssignment("derived reactive value")
            },
            get $() {
                if (effect.l & EFFECT_DERIVED_DIRTY) {
                    effect.l |= EFFECT_DERIVED_READING
                    runAndUpdateEffect(effect)
                    effect.l &= ~EFFECT_DERIVED_DIRTY
                } else {
                    if (activeEffect) {
                        appendLinksToActiveEffect(effect)
                    }
                }
                return targets[i].$
            }
        }
        ret.push(isDebugging ? wrapper : [wrapper, UNDEF])
    }
    return ret
}

export function derived(fn: Getter, debugSetter?: Setter) {
    return destructuringDerived(TOARRAY, fn, 1, debugSetter ? [debugSetter] : UNDEF)[0]
}
