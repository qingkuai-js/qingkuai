export function AssignmentToProps() {
    warn("An assignment to a unbound component prop is invalid, this operation has been ignored.")
}

export function AssignmentToDerived() {
    warn("An assignment to derived reacativity state is invalid, this operation has been ignored.")
}

export function WatchEffectDependenNoReactiveValue(funcName: string, isEffect = false) {
    const postfix = isEffect ? " again" : ""
    const desc = isEffect ? "callback" : "watch target"
    warn(
        `The ${desc} of [${funcName}] call not dependen any reactive value, and it will be never executed${postfix}.`
    )
}

export function DerivedDependenNoReactiveValue() {
    warn(
        "The derived reactivity state declaration does not dependen any reactive value, consider replacing it to a normal declaration statement."
    )
}

function warn(msg: string) {
    console.warn(msg)
}
