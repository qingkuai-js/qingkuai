import type { GeneralFunc, Getter } from "#type-declarations/tools";

import { invokeRender } from "./render";
import { isFunction } from "../../util/shared/assert";
import { markActiveEffectNoCheck } from "../reactivity/effect";
import { currentDestruction, currentInstance } from "../state";
import { defineProperty, reflectOwnKeys } from "../../util/shared/aliases";

export function renderSlot(
    name: string,
    anchor: ChildNode,
    source?: Record<string, Getter>,
    fallback?: GeneralFunc,
    ns?: boolean,
) {
    const componentInstance = currentInstance!;
    const parentDestruction = currentDestruction;
    const slot = componentInstance._internal.s?.[name];
    if (!slot) {
        if (fallback) {
            invokeRender(fallback, componentInstance, parentDestruction);
        }
    } else {
        invokeRender(
            () => slot(anchor, ns, wrapSlotContext(source)),
            componentInstance,
            parentDestruction,
        );
    }
}

function wrapSlotContext(source?: Record<string, Getter>) {
    if (!source) {
        return source;
    }

    const ret: Record<string, any> = {};
    for (const key of reflectOwnKeys(source)) {
        defineProperty(ret, key, {
            enumerable: true,
            get() {
                const getter = source[key as string];
                const value = isFunction(getter) ? getter() : getter;
                markActiveEffectNoCheck();
                return value;
            },
        });
    }
    return ret;
}
