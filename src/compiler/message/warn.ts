import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ASTLocation } from "#type-declarations/compiler"

import { messages } from "../state"

export const commonMessage = (<T extends Record<string, [number, ArbitraryFunc]>>(obj: T): T => {
    return obj
})({
    UnnecessaryReactiveMark: [
        9001,
        (kind?: string) => {
            return `This value will never change, so making it ${
                kind ? kind + " " : ""
            }reactive is unnecessary and it will be treated as a raw (non-reactive) value.`
        }
    ],
    IdentifierMaybeOverwritten: [
        9002,
        (name: string, scope: string) => {
            return `Top-level scope identifier "${name}" will be overwrittern in ${scope}.`
        }
    ],
    DeclareDerivedMixedSyntaticForms: [
        9003,
        () => {
            return "Mixing two syntactic forms to declare derived reactive value is not recommended."
        }
    ],
    UnnecessaryMutableDerivedDeclaration: [
        9004,
        () => {
            return "Derived reactive value is read-only and cannot be explicitly mutated. Declaring it as mutable is unnecessary, consider using const instead."
        }
    ]
})

// prettier-ignore
export const UnnecessaryReactiveMark = withLocation(
    ...commonMessage.UnnecessaryReactiveMark
)

// prettier-ignore
export const IdentifierMaybeOverwritten = withLocation(
    ...commonMessage.IdentifierMaybeOverwritten
)

export const DeclareDerivedMixedSyntaticForms = withLocation(
    ...commonMessage.DeclareDerivedMixedSyntaticForms
)

export const UnnecessaryMutableDerivedDeclaration = withLocation(
    ...commonMessage.UnnecessaryMutableDerivedDeclaration
)

function withLocation<T extends ArbitraryFunc>(code: number, fn: T) {
    function warn(...[loc, ...params]: [loc: ASTLocation, ...Parameters<T>]) {
        new CompileWarning(loc, code, fn(...params))
    }
    return warn
}

export class CompileWarning {
    constructor(public loc: ASTLocation, public code: number, public message: string) {
        messages.push({
            value: this,
            type: "warning"
        })
    }
}
