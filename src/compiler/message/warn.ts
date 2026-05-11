import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ASTLocation, CompileWarning, IdentifierStatus } from "#type-declarations/compiler"

import { messages } from "../state"

export const UnnecessarySpreadTag = withLocation(9012, (without: string) => {
    return `The <qk:spread> tag without ${without} is unnecessary.`
})

export const DuplicateEventFlag = withLocation(9011, (name: string) => {
    return `Duplicate event flag "${name}" is redundant and will be ignored.`
})

export const RedundantEventFlags = withLocation(9009, () => {
    return `Event flags for component event listeners are redundant and will be ignored.`
})

export const UnnecessaryReactiveMark = withLocation(9001, (status: IdentifierStatus) => {
    return `This value will never change, so marking it ${
        status === "reactive" ? "" : status + " "
    }reactive is unnecessary and it will be treated as a raw(non-reactive) value.`
})

export const DeclareDerivedMixedSyntaticForms = withLocation(9003, () => {
    return "Mixing two syntactic forms to declare derived reactive value is not recommended."
})

export const IdentifierMaybeOverwritten = withLocation(9002, (name: string, scope: string) => {
    return `Top-level scope identifier "${name}" will be overwrittern in ${scope}.`
})

export const RedundantRawMark = withLocation(9005, () => {
    return `Marking a const with a literal initializer as raw is redundant, as it is treated as raw by default.`
})

export const UnnecessaryHtmlDirective = withLocation(9008, () => {
    return `The "#html" directive without a value has no effect because the element content is entirely static.`
})

export const RedundantDirectiveValue = withLocation(9006, (directive: string) => {
    return `The "${directive}" directive does not need a value, and the redundant directive value will be ignored.`
})

export const RedundantArgsForIntrinsic = withLocation(
    9016,
    (intrinsic: string, expected: number, got: number) => {
        return `The "${intrinsic}" intrinsic expects exactly ${expected} argument${expected > 1 ? "s" : ""}, but got ${got}. The redundant arguments will be ignored.`
    }
)

export const DuplicateDefaultDeclaration = withLocation(9013, (subject: string) => {
    return `This default value definition for "${subject}" is ignored because it is overridden by a later one.`
})

export const RedundantBooleanAttributeValue = withLocation(
    9007,
    (tag: string, attribute: string) => {
        return `The "${attribute}" attribute on <${tag}> tag is a boolean attribute, and the redundant attribute value will be ignored.`
    }
)

export const KeyFlagIgnoredOnNonKeyboardEvent = withLocation(
    9010,
    (name: string, eventName: string) => {
        return `The event flag "${name}" only valid on keyboard events ("keyup", "keydown", "keypress"). It has no effect on "${eventName}" and will be ignored.`
    }
)

export const UnnecessaryMutableDerivedDeclaration = withLocation(9004, () => {
    return `The derived reactive value is read-only and cannot be explicitly mutated. Declaring it as mutable is unnecessary, consider declaring it with \`const\`.`
})

export function isCompileWarning(v: any): v is CompileWarning {
    return v instanceof QingkuaiCompileWarning
}

function withLocation<T extends ArbitraryFunc>(code: number, fn: T) {
    function warn(...[loc, ...params]: [loc: ASTLocation, ...Parameters<T>]) {
        new QingkuaiCompileWarning(loc, code, fn(...params))
    }
    return warn
}

class QingkuaiCompileWarning implements CompileWarning {
    constructor(
        public loc: ASTLocation,
        public code: number,
        public message: string
    ) {
        messages.push({
            value: this,
            type: "warning"
        })
    }
}
