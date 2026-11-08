import type { GeneralFunc } from "#type-declarations/tools";
import type { ComponentInstance, Destruction } from "#type-declarations/runtime";

import { createDestruction } from "../destroy";
import { noTracking } from "../reactivity/optimization";
import { currentInstance, setCurrentInstance, setCurrentDestruction } from "../state";

export function invokeRender(
    render: GeneralFunc,
    instance: ComponentInstance<any>,
    parentDestruction: Destruction | null,
) {
    const originalInstance = currentInstance;
    const destruction = createDestruction(parentDestruction, instance);
    setCurrentInstance(instance);
    noTracking(render);
    setCurrentInstance(originalInstance);
    setCurrentDestruction(parentDestruction);
    return destruction;
}
