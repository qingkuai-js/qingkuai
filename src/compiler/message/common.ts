import type { GeneralFunc } from "../../util/types"

export const commonMessage = (<T extends Record<string, [number, GeneralFunc]>>(obj: T): T => {
    return obj
})({
    IdentifierFormatIsNotAllowed: [
        1030,
        (identifierName: string) => {
            return `The banned identifier(${identifierName}) format is not allowed in [.qk] file.`
        }
    ]
})
