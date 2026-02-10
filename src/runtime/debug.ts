import type { Getter, Setter } from "#type-declarations/tools"

export function alias(getter: Getter, setter: Setter) {
    return [
        {
            get $() {
                return getter()
            },
            set $(value) {
                setter(value)
            }
        },
        getter()
    ]
}
