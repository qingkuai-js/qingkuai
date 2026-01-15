import type { ArbitraryFunc } from "#type-declarations/tools"

import { isArray } from "../../util/shared/assert"

export const WatchEffectDependantNoReactiveValue = withCode(
    8001,
    (fn: ArbitraryFunc, by: string) => {
        return [
            `No reactive values were dependant during the execution of effect${
                by ? " that created with " + by : ""
            }. The effect has been dstroyed because it will no longer be triggered in future. By: %O`,
            fn
        ]
    }
)

export const InvalidAssignment = withCode(8002, (target: string) => {
    return `An assignment to the ${target} is invalid, and this operation has been ignored.`
})

function withCode<T extends ArbitraryFunc<string | any[]>>(code: number, getter: T) {
    return (...args: Parameters<T>) => {
        const getterRet = getter(...args)
        console.warn(
            `[QingKuai Warnning](${code}):`,
            ...(isArray(getterRet) ? getterRet : [getterRet])
        )
    }
}
