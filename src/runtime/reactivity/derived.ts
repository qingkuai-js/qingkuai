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

        // 这里不移除 EFFECT_DIREVED_READING 标志，因为依赖有效性检查需要访问它，并在结束后移除
        // The EFFECT_DIREVED_READING flag is not removed here, because the dependency
        // validity check needs to access it and remove it after the end
        //
        // See `checkDerivedEffectValidity` in `./effect.ts`

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
    return ((effect.g = getter), ret)
}

export function derived(fn: Getter, debugSetter?: Setter) {
    return destructuringDerived(TOARRAY, fn, 1, debugSetter ? [debugSetter] : UNDEF)[0]
}
