import type { GeneralFunc } from "#type-declarations/tools"
import type { ComponentInstanceBase } from "#type-declarations/runtime"

import { createDestruction } from "../destroy"
import { backToParentDestruction, currentInstance, setCurrentInstance } from "../state"

export function invokeRender(render: GeneralFunc, instance?: ComponentInstanceBase) {
    const startInstance = currentInstance
    if (instance && instance !== startInstance) {
        setCurrentInstance(instance)
    }

    const destruction = createDestruction()
    render()
    backToParentDestruction()
    setCurrentInstance(startInstance)
    return destruction
}
