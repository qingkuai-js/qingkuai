import type { GeneralFunc } from "../../util/types"

import { isNumber } from "../../util/shared/assert"

export const commonMessage = (<T extends Record<string, [number, GeneralFunc]>>(obj: T): T => {
    return obj
})({
    IdentifierFormatIsNotAllowed: [
        1029,
        (identifierName: string) => {
            return `The banned identifier(${identifierName}) format is not allowed.`
        }
    ],
    RegisterExsitingIdentifierName: [
        1021,
        (name: string) => {
            return `The identifier name(${name}) to register already exists in the top scope.`
        }
    ],
    BadExportRelatedStatement: [
        1042,
        () => {
            return `Export related statements can not appear in embedded script language block.`
        }
    ],
    BadValueToReferenceAttribute: [
        1031,
        (exp: string, allowConst: boolean) => {
            return `Only assignable expression(${
                allowConst ? "" : "non-const "
            }lvalue) can be passed to reference attribute, the given expression(${exp}) is not allowed.`
        }
    ],
    ReactCompilerFuncNotInTopScope: [
        1025,
        () => {
            return "Reactivity related compiler helper functions(rea, stc, der) must be used in the top scope."
        }
    ],
    WatchCompilerFuncMissingArg: [
        1040,
        (funcName: string, received: number) => {
            return `The wathc related compiler helper function(${funcName}) required 2 arguments, but got ${received}.`
        }
    ],
    ReactCompilerFuncWithoutVariableDeclaration: [
        1027,
        () => {
            return "Reactivity related compiler helper functions(rea, stc, der) must be used for a variable declaration statement."
        }
    ],
    DestructureReactFuncWithNoArg: [
        1030,
        (funcName: string) => {
            return `Compiler helper function(${funcName}) will return undefined when no argument is passed, so it cannot be destructured.`
        }
    ],
    ConvenientDerivedWithOtherReactFunc: [
        1039,
        (funcName: string) => {
            return `Using both short hand derived state declaration(using $ prefix) and reactivity realted compiler helper function(${funcName}) is ambiguous.`
        }
    ],

    // warnings
    RedundantArgsForCompilerFunc: [
        9001,
        (fn: string, need: number | string) => {
            let needMsg = "requires only one parameter"
            if (!isNumber(need) || need > 1) {
                needMsg = `accepts a maximum of ${need} parameters`
            }
            return `The compiler helper function(${fn}) ${needMsg}, and the excess parameters has been ignored.`
        }
    ],
    IdentifierMaybeOverwritten: [
        9002,
        (identifierName: string) => {
            return `The top scope identifier(${identifierName}) may be overwrittern in inline event.`
        }
    ],
    MixTwoSyntaxOfDerived: [
        9003,
        () => {
            return "Mixing the two syntax to declare derived reactive state is not recommended."
        }
    ]
})
