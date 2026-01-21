import type { Getter, Setter } from "#type-declarations/tools"

export function alias(getter: Getter, setter: Setter) {
    return [
        getter(),
        {
            get $() {
                return getter()
            },
            set $(value) {
                setter(value)
            }
        }
    ]
}