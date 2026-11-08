import type {
    Destruction,
    TraverseContext,
    ComponentInstanceBase,
} from "#type-declarations/runtime";

import { NIL } from "./constants";

export let currentDestruction: Destruction | null = NIL;
export let currentInstance: ComponentInstanceBase | null = NIL;

export const eventRegisterInfo: Record<string, boolean[]> = {};

// 展开遍历目标时复用同一个暂存对象，避免每行分配；算完立刻消费，不能跨调用留存
// A single scratch object is reused while resolving a traversable, so no allocation
// happens per row. It is consumed immediately and must not be retained across calls.
export const resolvedContext: TraverseContext = { m: NIL, x: NIL };

export function backToParentDestruction() {
    if (!currentDestruction) {
        return;
    }
    setCurrentDestruction(currentDestruction.p);
}

export function setCurrentDestruction(value: Destruction | null) {
    return (currentDestruction = value);
}

export function setCurrentInstance(value: ComponentInstanceBase | null) {
    return (currentInstance = value);
}
