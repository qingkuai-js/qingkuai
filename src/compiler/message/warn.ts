import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ASTLocation, IdentifierStatus } from "#type-declarations/compiler"

import { messages } from "../state"

export const commonMessage = (<T extends Record<string, [number, ArbitraryFunc]>>(obj: T): T => {
    return obj
})({
    UnnecessaryReactiveMark: [
        9001,
        (status: IdentifierStatus) => {
            return `This value will never change, so making it ${
                status === "reactive" ? "" : status + " "
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
    RedundantRawMark: [
        9005,
        () => {
            return `Marking a const with a literal initializer as raw is redundant, as it is treated as raw by default.`
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
export const RedundantRawMark = withLocation(
    ...commonMessage.RedundantRawMark
)

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

export const RedundantDirectiveValue = withLocation(9006, (directive: string) => {
    return `The "${directive}" directive does not need a value, and its value has been ignored.`
})

export const RedundantBooleanAttributeValue = withLocation(
    9007,
    (tag: string, attribute: string) => {
        return `The "${attribute}" attribute on <${tag}> tag is a boolean attribute, the redundant attribute value will be ignored.`
    }
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
