/**
 * 为了整个文件可读性，应尽量将较少代码的警告方法放在靠前的位置，但这样会导致警告代码
 * 不能与方法的顺序保持一致，所以这里在文件头记录了最后一个使用的警告代码（在下方的
 * last-error-code处）每次添加警告方法并使用新的警告代码时，需要将本次使用的警告
 * 代码更新到文件的头部注释中（约定：新警告代码为 last-error-code + 1）
 *
 * For the sake of the overall readability of this file, we should try
 * put the warn method with less code in the front, however this results
 * in warn codes can not conform to the order of the methods.
 * So, the last warn code used is recorded in the file header comment
 * (at last-warn-code below), each time you add a new warn method and use a
 * new warn code, you need update the warn code you used this time to the header
 * comment of this file. (Convention: the new warn code is: last-warn-code + 1)
 *
 * last-warn-code: 8006
 *
 * 警告代码解释：以数字9开头的代码表示这是一个运行时警告
 * Warning Code Explanation: Code beginning with the number 8 indicates that this is a runtime warning
 */

import type { GeneralFunc } from "../../util/types"

export const InvalidTargetForTargetDirective = withCode(8006, () => {
    return `The given value of #target directive is not a valid DOM Node.`
})

export function AssignmentToDOMGetterProp(error: any) {
    console.warn(`[QingKuai Warnning](${8001}):`, "Operation is invalid." + error)
}

export const AssignmentToProps = withCode(8002, () => {
    return "An assignment to a unbound component prop is invalid, this operation has been ignored."
})

export const AssignmentToDerived = withCode(8003, () => {
    return "An assignment to derived reacativity state is invalid, this operation has been ignored."
})

export const WatchEffectDependentNoReactiveValue = withCode(
    8004,
    (funcName: string, isEffect = false) => {
        const postfix = isEffect ? " again" : ""
        const desc = isEffect ? "callback" : "watch target"
        return `The ${desc} of [${funcName}] call not dependen any reactive value, and it will be never executed${postfix}.`
    }
)

export const DerivedDependenNoReactiveValue = withCode(8005, () => {
    "The derived reactivity state declaration does not dependen any reactive value, consider replacing it to a normal declaration statement."
})

function withCode<T extends GeneralFunc>(code: number, msgGetter: T) {
    return (...args: Parameters<T>) => {
        console.warn(`[QingKuai Warnning](${code}):`, msgGetter(...args))
    }
}
