import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ASTLocation } from "#type-declarations/compiler"

import { messages } from "../state"

export const commonMessage = (<T extends Record<string, [number, ArbitraryFunc]>>(obj: T): T => {
    return obj
})({
    IdentifierMaybeOverwritten: [
        9001,
        (name: string, scope: string) => {
            return `Top-level scope identifier "${name}" will be overwrittern in ${scope}.`
        }
    ],
    DeclarationWithVarWillNotBeReactive: [
        9002,
        (name: string) => {
            return `Variable "${name}" is declared using \`var\` and will not be reactive.\nUse \`let\` or \`const\` for reactivity, or mark the initializer with \`raw()\` to silence this warning.`
        }
    ]
})

// prettier-ignore
export const IdentifierMaybeOverwritten = withLocation(
    ...commonMessage.IdentifierMaybeOverwritten
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
