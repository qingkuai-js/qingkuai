import type { GeneralFunc } from "#type-declarations/tools"
import type { ComponentInstanceBase, Destruction } from "#type-declarations/runtime"

import { createDestruction } from "../destroy"
import { currentInstance, setCurrentInstance, setCurrentDestruction } from "../state"

export function invokeRender(
    render: GeneralFunc,
    instance: ComponentInstanceBase,
    parentDestruction: Destruction | null
) {
    const originalInstance = currentInstance
    const destruction = createDestruction(parentDestruction)
    if (instance) {
        setCurrentInstance(instance)
    }
    render()
    setCurrentInstance(originalInstance)
    setCurrentDestruction(parentDestruction)
    return destruction
}
