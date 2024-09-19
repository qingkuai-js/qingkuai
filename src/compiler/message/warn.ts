import { isNumber } from "../../util/shared"

export function RedundantArgs(fn: string, need: number | string) {
    let needMsg = "requires only one parameter"
    if (!isNumber(need) || need > 1) {
        needMsg = `accepts a maximum of ${need} parameters`
    }
    warn(`${fn} ${needMsg}, and the excess parameters has been ignored.`)
}

export function DerLoseReactivity() {
    warn("Destructure the return value of der will result in a loss of reacativity.")
}

export function MixTwoSyntaxOfDerived() {
    warn("Mixing the two syntax to declare derived reactive state is not recommended.")
}

export function InvalidEventFlag(flagName: string, eventName: string) {
    warn(`Invalid flag(${flagName}) for event(@${eventName}) and it has been ignored.`)
}

export function InvalidEventForSlot(eventName: string) {
    warn(`Event listener(${eventName}) is invalid for slot tag, and it has been ignored.`)
}

export function InvalidEventFlagForComponent(flagStr: string) {
    flagStr = flagStr.replaceAll("|", ", ")
    warn(
        `The event parameter for component can not accept any flag(${flagStr}), and they has been ignored.`
    )
}

function warn(msg: string) {
    console.warn(msg)
}
