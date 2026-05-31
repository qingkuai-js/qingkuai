import { isArray } from "../../util/shared/assert"

export function InvalidAssignment(target: string) {
    warnWithCode(
        8001,
        `An assignment to the ${target} is invalid, and this operation has been ignored.`
    )
}

function warnWithCode(code: number, message: any, ...args: any[]) {
    const payload = isArray(message) ? message : [message, ...args]
    console.warn(`[QingKuai Warnning](${code}):`, ...payload)
}
