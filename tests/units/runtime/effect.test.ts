import type { Getter } from "#type-declarations/tools";
import type { EffectCallback, WatchCallback } from "#type-declarations/runtime";

import {
    disposeEffect,
    watch as _watch,
    effect as _effect,
    syncWatch as _syncWatch,
    postWatch as _postWatch,
    preWatch as _preWatch,
    preEffect as _preEffect,
    postEffect as _postEffect,
    syncEffect as _syncEffect,
    renderEffect as _renderEffect,
} from "../../../src/runtime/reactivity/effect";
import {
    currentInstance,
    currentDestruction,
    setCurrentDestruction,
    backToParentDestruction,
} from "../../../src/runtime/state";
import {
    sleep,
    getErrorMessage,
    getCurrentEffect,
    createTestInstance,
    destructionHasEffect,
} from "../../../src/util/testing/sundry";
import {
    WRAPPER,
    TIMING_PRE,
    TIMING_POST,
    TIMING_SYNC,
    ITERATOR_KEYS,
    TIMING_UNSET,
    EFFECT_DISABLED,
    EFFECT_DISPOSED,
} from "../../../src/runtime/reactivity/constants";
import { checkEffectDependaceManager } from "./_match";
import { isReactive } from "../../../src/util/runtime/assert";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DST_DESTRUCTED } from "../../../src/util/shared/flags";
import { matchGlobalError } from "../../../src/util/testing/match";
import { isArray, isNumber } from "../../../src/util/shared/assert";
import { activeEffect } from "../../../src/runtime/reactivity/state";
import { arrayFrom, emptyArr } from "../../../src/util/shared/arrays";
import { createWarningMatcher } from "../../../src/util/testing/sundry";
import { constReact, react } from "../../../src/runtime/reactivity/value";
import { NIL, NOOP, BEFORE_DESTROY } from "../../../src/runtime/constants";
import { MaximumUpdateDepthExceeded } from "../../../src/runtime/messages/error";
import { getRefProperty, toRaw, nextTick } from "../../../src/util/runtime/sundry";
import { batchUpdating, noUpdating } from "../../../src/runtime/reactivity/optimization";
import { onBeforeDestroy, onBeforeUpdate, runHooks } from "../../../src/runtime/component";
import { createDestruction, destroy, pushDestructionCleaner } from "../../../src/runtime/destroy";

const arr: any[] = [];
const invokeMarker = vi.fn();
const testInstance = createTestInstance();
const warningMatcher = createWarningMatcher();
const timings = [TIMING_UNSET, TIMING_PRE, TIMING_POST, TIMING_SYNC];

const effect = (callback: EffectCallback) => {
    const handle = _effect(testInstance, callback);
    return { handle, effect: getCurrentEffect()! };
};
const preEffect = (callback: EffectCallback) => {
    const handle = _preEffect(testInstance, callback);
    return { handle, effect: getCurrentEffect()! };
};
const postEffect = (callback: EffectCallback) => {
    const handle = _postEffect(testInstance, callback);
    return { handle, effect: getCurrentEffect()! };
};
const syncEffect = (callback: EffectCallback) => {
    const handle = _syncEffect(testInstance, callback);
    return { handle, effect: getCurrentEffect()! };
};
const watch = <T>(getter: Getter<T>, callback: WatchCallback<T>) => {
    const handle = _watch(testInstance, getter, callback);
    return { handle, effect: getCurrentEffect()! };
};
const preWatch = <T>(getter: Getter<T>, callback: WatchCallback<T>) => {
    const handle = _preWatch(testInstance, getter, callback);
    return { handle, effect: getCurrentEffect()! };
};
const postWatch = <T>(getter: Getter<T>, callback: WatchCallback<T>) => {
    const handle = _postWatch(testInstance, getter, callback);
    return { handle, effect: getCurrentEffect()! };
};
const syncWatch = <T>(getter: Getter<T>, callback: WatchCallback<T>) => {
    const handle = _syncWatch(testInstance, getter, callback);
    return { handle, effect: getCurrentEffect()! };
};
const renderEffect = (callback: EffectCallback) => {
    _renderEffect(callback);
    return getCurrentEffect()!;
};

const watchEffectFuncs = [watch, preWatch, postWatch, syncWatch];
const reactiveEffectFuncs = [effect, preEffect, postEffect, syncEffect];

const cleanup = () => {
    emptyArr(arr);
    invokeMarker.mockClear();
    warningMatcher.mockClear();
};

beforeEach(cleanup);

function makeConsecutiveNumbersArr(length: number) {
    return arrayFrom({ length }, (_, i) => i);
}

async function flushThrowingUpdate(trigger: () => void) {
    const ignore = () => {};
    process.on("unhandledRejection", ignore);
    try {
        trigger();
        await nextTick();
        await sleep(0);
    } finally {
        process.off("unhandledRejection", ignore);
    }
}

test("destroy should disconnect destruction from parent/effects", () => {
    const parent = currentDestruction!;
    const nested = createDestruction(parent);
    const cleaner = vi.fn();
    pushDestructionCleaner(cleaner);

    const tracked = react(0);
    const nestedEffect = renderEffect(() => tracked.$);
    const nestedEffects = nested.e;
    renderEffect(NOOP);
    expect(nested.e).toBe(nestedEffects);

    createDestruction(nested, NIL);
    const nestedChildEffect = renderEffect(() => tracked.$);

    backToParentDestruction();
    backToParentDestruction();

    expect(currentDestruction).toBe(parent);
    expect(parent.c?.includes(nested)).toBeTruthy();

    destroy(nested, false);

    expect(cleaner).toHaveBeenCalledTimes(1);
    expect(nestedEffect.d).toBeNull();
    expect(nestedChildEffect.d).toBeNull();
    expect(parent.c?.includes(nested)).toBeFalsy();
    expect(nested.l).toBe(DST_DESTRUCTED);
    expect(nested.e).toBeNull();
    expect(nested.c).toBeNull();
    expect(nested.a).toBeNull();
    expect(nested.m).toBeNull();
    expect(nested.p).toBeNull();
    expect(nested.s).toBeNull();
    expect(nested.n).toBeNull();
    expect(currentDestruction).toBe(parent);
});

test("creating an effect on a destroyed destruction warns and discards", () => {
    const parent = currentDestruction!;
    const nested = createDestruction(parent);
    backToParentDestruction();
    destroy(nested, false);

    const callback = vi.fn();
    setCurrentDestruction(nested);
    const handle = _effect(testInstance, callback);
    setCurrentDestruction(parent);

    expect(callback).not.toHaveBeenCalled();
    expect(warningMatcher.mock.calls.some(args => args.join(" ").includes("8003"))).toBe(true);
    expect(handle).toBeDefined();
});

test("Functions of render effect", async () => {
    const value = react(1);
    const effect = renderEffect(() => {
        arr.push(value.$);
        return invokeMarker;
    });
    expect(arr).toEqual([1]);

    checkEffectDependaceManager(effect, {
        destroyed: false,
        timing: TIMING_UNSET,
        cleaner: invokeMarker,
        dependencies: [value],
        destruction: currentDestruction,
    });

    value.$++;
    await nextTick();
    expect(arr).toEqual([1, 2]);
    expect(invokeMarker).toHaveBeenCalledTimes(1);

    disposeEffect(effect);
    expect(invokeMarker).toHaveBeenCalledTimes(2);
    expect(effect.l & EFFECT_DISABLED).toBeTruthy();
    expect(effect.l & EFFECT_DISPOSED).toBeTruthy();
    expect(destructionHasEffect(currentDestruction, effect)).toBeFalsy();

    --value.$;
    await nextTick();
    expect(arr).toEqual([1, 2]);
    expect(invokeMarker).toHaveBeenCalledTimes(2);
});

test("Functions of reactive effect", async () => {
    for (let i = 0; i < reactiveEffectFuncs.length; cleanup(), i++) {
        const value = react(1);
        const { handle, effect } = reactiveEffectFuncs[i](() => {
            arr.push(value.$);
            return invokeMarker;
        });
        expect(arr).toEqual([1]);

        checkEffectDependaceManager(effect, {
            destroyed: false,
            timing: timings[i],
            cleaner: invokeMarker,
            dependencies: [value],
            destruction: currentDestruction,
        });

        value.$++;
        if (i !== 3) {
            await nextTick();
        }
        expect(arr).toEqual([1, 2]);
        expect(invokeMarker).toHaveBeenCalledTimes(1);

        handle.pause();
        expect(invokeMarker).toHaveBeenCalledTimes(1);
        expect(effect.l & EFFECT_DISPOSED).toBeFalsy();
        expect(effect.l & EFFECT_DISABLED).toBeTruthy();
        expect(destructionHasEffect(currentDestruction, effect)).toBeTruthy();

        value.$--;
        if (i !== 3) {
            await nextTick();
        }
        expect(arr).toEqual([1, 2]);
        expect(invokeMarker).toHaveBeenCalledTimes(1);

        handle.resume();
        expect(effect.l & EFFECT_DISABLED).toBeFalsy();
        expect(effect.l & EFFECT_DISPOSED).toBeFalsy();

        value.$ *= 10;
        if (i !== 3) {
            await nextTick();
        }
        expect(arr).toEqual([1, 2, 10]);
        expect(invokeMarker).toHaveBeenCalledTimes(2);

        handle.stop();
        expect(invokeMarker).toHaveBeenCalledTimes(3);
        expect(effect.l & EFFECT_DISABLED).toBeTruthy();
        expect(effect.l & EFFECT_DISPOSED).toBeTruthy();
        expect(destructionHasEffect(currentDestruction, effect)).toBeFalsy();

        value.$ += 10;
        if (i !== 3) {
            await nextTick();
        }
        expect(arr).toEqual([1, 2, 10]);
        expect(invokeMarker).toHaveBeenCalledTimes(3);

        handle.resume();
        expect(invokeMarker).toHaveBeenCalledTimes(3);
        expect(effect.l & EFFECT_DISABLED).toBeTruthy();
        expect(effect.l & EFFECT_DISABLED).toBeTruthy();
        expect(destructionHasEffect(currentDestruction, effect)).toBeFalsy();

        value.$ /= 10;
        if (i !== 3) {
            await nextTick();
        }
        expect(arr).toEqual([1, 2, 10]);
        expect(invokeMarker).toHaveBeenCalledTimes(3);
    }
});

test("Functions of watch effect", async () => {
    for (let i = 0; i < watchEffectFuncs.length; cleanup(), i++) {
        let pre: any = undefined;
        let cur: any = undefined;
        const map = constReact(new Map([[1, 99]]));

        const { handle, effect } = watchEffectFuncs[i](
            () => map.get(1),
            (p, c) => {
                [pre, cur] = [p, c];
                return invokeMarker;
            },
        );
        expect(arr.length).toBe(0);
        expect(pre).toBeUndefined();
        expect(cur).toBeUndefined();

        checkEffectDependaceManager(effect, {
            cleaner: null,
            destroyed: false,
            timing: timings[i],
            dependencies: [[map, 1]],
            destruction: currentDestruction,
        });

        map.set(1, map.get(1) + 1);
        if (i !== 3) {
            await nextTick();
        }
        expect(pre).toBe(99);
        expect(cur).toBe(100);
        expect(arr.length).toBe(0);
        expect(effect.c).toBe(invokeMarker);
        expect(invokeMarker).toHaveBeenCalledTimes(0);

        map.set(1, 97);
        if (i !== 3) {
            await nextTick();
        }
        expect(pre).toBe(100);
        expect(cur).toBe(97);
        expect(invokeMarker).toHaveBeenCalledTimes(1);

        handle.pause();
        expect(invokeMarker).toHaveBeenCalledTimes(1);
        expect(effect.l & EFFECT_DISPOSED).toBeFalsy();
        expect(effect.l & EFFECT_DISABLED).toBeTruthy();
        expect(destructionHasEffect(currentDestruction, effect)).toBeTruthy();

        map.set(1, 0);
        if (i !== 3) {
            await nextTick();
        }
        expect(pre).toBe(100);
        expect(cur).toBe(97);
        expect(invokeMarker).toHaveBeenCalledTimes(1);

        handle.resume();
        expect(invokeMarker).toHaveBeenCalledTimes(1);
        expect(effect.l & EFFECT_DISPOSED).toBeFalsy();
        expect(effect.l & EFFECT_DISABLED).toBeFalsy();
        expect(destructionHasEffect(currentDestruction, effect)).toBeTruthy();

        map.set(1, map.get(1) - 1);
        if (i !== 3) {
            await nextTick();
        }
        expect(pre).toBe(97);
        expect(cur).toBe(-1);
        expect(invokeMarker).toHaveBeenCalledTimes(2);

        handle.stop();
        expect(invokeMarker).toHaveBeenCalledTimes(3);
        expect(effect.l & EFFECT_DISPOSED).toBeTruthy();
        expect(effect.l & EFFECT_DISABLED).toBeTruthy();
        expect(destructionHasEffect(currentDestruction, effect)).toBeFalsy();

        map.set(1, -99);
        if (i !== 3) {
            await nextTick();
        }
        expect(pre).toBe(97);
        expect(cur).toBe(-1);
        expect(invokeMarker).toHaveBeenCalledTimes(3);

        handle.resume();
        expect(invokeMarker).toHaveBeenCalledTimes(3);
        expect(effect.l & EFFECT_DISPOSED).toBeTruthy();
        expect(effect.l & EFFECT_DISABLED).toBeTruthy();
        expect(destructionHasEffect(currentDestruction, effect)).toBeFalsy();
    }
});

test("Running sequence of different effects", async () => {
    const value = react(0);
    [postEffect, renderEffect, preEffect, syncEffect, renderEffect, preEffect, postEffect].forEach(
        (fn, index) => {
            fn(() => {
                value.$ && arr.push(1 + index);
            });
        },
    );
    [preWatch, postWatch, syncWatch, watch, postWatch, watch, preWatch, syncWatch].forEach(
        (fn, index) => {
            fn(
                () => value.$,
                () => {
                    arr.push(-1 - index);
                },
            );
        },
    );
    value.$++;
    await nextTick();
    expect(arr).toEqual([4, -3, -8, 3, 6, -1, -7, 2, 5, -4, -6, 1, 7, -2, -5]);
});

test("Functions of effect that depend on Set", async () => {
    const set = constReact(new Set([1, 2, 3]));
    const effect = renderEffect(() => {
        arr.push(set.size);
        return invokeMarker;
    });
    expect(arr).toEqual([3]);

    checkEffectDependaceManager(effect, {
        destroyed: false,
        timing: TIMING_UNSET,
        cleaner: invokeMarker,
        destruction: currentDestruction,
        dependencies: [[set, getRefProperty(set[WRAPPER].l, "size")]],
    });

    set.add(1);
    await nextTick();
    expect(arr).toEqual([3]);
    expect(invokeMarker).toHaveBeenCalledTimes(0);

    set.delete(4);
    await nextTick();
    expect(arr).toEqual([3]);
    expect(invokeMarker).toHaveBeenCalledTimes(0);

    set.add(4);
    await nextTick();
    expect(arr).toEqual([3, 4]);
    expect(invokeMarker).toHaveBeenCalledTimes(1);

    set.delete(1);
    await nextTick();
    expect(arr).toEqual([3, 4, 3]);
    expect(invokeMarker).toHaveBeenCalledTimes(2);

    set.add("size");
    await nextTick();
    expect(arr).toEqual([3, 4, 3, 4]);
    expect(invokeMarker).toHaveBeenCalledTimes(3);

    disposeEffect(effect);
    cleanup();

    // attached property should not be influenced by internal data
    renderEffect(() => {
        invokeMarker();
        arr.push(set.custom);
    });
    expect(arr).toEqual([undefined]);
    expect(invokeMarker).toHaveBeenCalledTimes(1);

    set.custom = null;
    await nextTick();
    expect(arr).toEqual([undefined, null]);
    expect(invokeMarker).toHaveBeenCalledTimes(2);

    set.add("custom");
    await nextTick();
    expect(invokeMarker).toHaveBeenCalledTimes(2);
});

test("Functions of effect that depend on Map", async () => {
    const map = constReact(new Map());
    const effect1 = renderEffect(() => {
        arr.push(map.size);
        return invokeMarker;
    });
    const effect2 = renderEffect(() => {
        arr.push(map.get(1));
        return invokeMarker;
    });
    expect(arr).toEqual([0, undefined]);

    checkEffectDependaceManager(effect1, {
        destroyed: false,
        timing: TIMING_UNSET,
        cleaner: invokeMarker,
        destruction: currentDestruction,
        dependencies: [[map, getRefProperty(map[WRAPPER].l, "size")]],
    });
    checkEffectDependaceManager(effect2, {
        destroyed: false,
        timing: TIMING_UNSET,
        cleaner: invokeMarker,
        dependencies: [[map, 1]],
        destruction: currentDestruction,
    });

    map.delete(1);
    await nextTick();
    expect(arr).toEqual([0, undefined]);
    expect(invokeMarker).toHaveBeenCalledTimes(0);

    map.set(1, 99);
    await nextTick();
    expect(arr).toEqual([0, undefined, 1, 99]);
    expect(invokeMarker).toHaveBeenCalledTimes(2);

    map.set(1, 999);
    await nextTick();
    expect(invokeMarker).toHaveBeenCalledTimes(3);
    expect(arr).toEqual([0, undefined, 1, 99, 999]);

    map.delete(1);
    await nextTick();
    expect(invokeMarker).toHaveBeenCalledTimes(5);
    expect(arr).toEqual([0, undefined, 1, 99, 999, 0, undefined]);

    map.set("size", "");
    await nextTick();
    expect(invokeMarker).toHaveBeenCalledTimes(6);
    expect(arr).toEqual([0, undefined, 1, 99, 999, 0, undefined, 1]);

    disposeEffect(effect1);
    map.clear();
    cleanup();

    // attached property should not be influenced by internal data
    renderEffect(() => {
        invokeMarker();
        arr.push(map.custom);
    });
    expect(arr).toEqual([undefined]);
    expect(invokeMarker).toHaveBeenCalledTimes(1);

    map.custom = null;
    await nextTick();
    expect(arr).toEqual([undefined, null]);
    expect(invokeMarker).toHaveBeenCalledTimes(2);

    map.set("custom", "");
    await nextTick();
    expect(arr).toEqual([undefined, null]);
    expect(invokeMarker).toHaveBeenCalledTimes(2);
});

test("Modify the length property of Array", () => {
    const nums = constReact([1, 2, 3]);
    syncEffect(() => {
        invokeMarker();
        arr.push(nums[2]);
    });
    expect(arr).toEqual([3]);
    expect(invokeMarker).toHaveBeenCalledTimes(1);

    nums.length = 4;
    expect(arr).toEqual([3]);
    expect(invokeMarker).toHaveBeenCalledTimes(1);

    nums.length = 2;
    expect(arr).toEqual([3, undefined]);
    expect(invokeMarker).toHaveBeenCalledTimes(2);

    nums.push(3);
    expect(arr).toEqual([3, undefined, 3]);
    expect(invokeMarker).toHaveBeenCalledTimes(3);

    nums[2] = undefined;
    expect(invokeMarker).toHaveBeenCalledTimes(4);
    expect(arr).toEqual([3, undefined, 3, undefined]);

    nums.length = 0;
    expect(invokeMarker).toHaveBeenCalledTimes(4);
    expect(arr).toEqual([3, undefined, 3, undefined]);
});

test("Effect should not be re-run when the value has not been modified", async () => {
    for (const effectFunc of reactiveEffectFuncs) {
        const count = react(1);
        invokeMarker.mockClear();
        effectFunc(() => {
            count.$;
            invokeMarker();
        });
        expect(invokeMarker).toHaveBeenCalledTimes(1);

        count.$ = 1;
        await nextTick();
        expect(invokeMarker).toHaveBeenCalledTimes(1);

        const obj = {};
        count.$ = obj;
        await nextTick();
        expect(invokeMarker).toHaveBeenCalledTimes(2);

        count.$ = constReact(obj);
        await nextTick();
        expect(invokeMarker).toHaveBeenCalledTimes(2);
    }

    for (const watchFunc of watchEffectFuncs) {
        const obj = constReact({});
        invokeMarker.mockClear();
        watchFunc(() => {
            invokeMarker();
            return obj.a;
        }, NOOP);
        expect(invokeMarker).toHaveBeenCalledTimes(1);

        const sub = constReact([]);
        obj.a = sub;
        await nextTick();
        expect(invokeMarker).toHaveBeenCalledTimes(2);

        obj.a = toRaw(sub);
        await nextTick();
        expect(invokeMarker).toHaveBeenCalledTimes(2);
    }
});

test("Effect chains propagate only along their expected dependency paths", async () => {
    for (let i = 0; i < reactiveEffectFuncs.length; cleanup(), i++) {
        const obj = react({
            a: 1,
            b: 2,
        });
        reactiveEffectFuncs[i](() => {
            arr.push(obj.$.a);
            return invokeMarker;
        });
        reactiveEffectFuncs[i](() => {
            arr.push(obj.$);
            return invokeMarker;
        });
        reactiveEffectFuncs[i](() => {
            arr.push(obj.$.b);
            return invokeMarker;
        });

        const originRaw = toRaw(obj.$);
        expect(arr).toEqual([1, originRaw, 2]);

        obj.$.a++;
        if (i !== 3) {
            await nextTick();
        }
        expect(arr).toEqual([1, originRaw, 2, 2]);
        expect(invokeMarker).toHaveBeenCalledTimes(1);

        obj.$ = {
            a: 2,
            b: 99,
        };
        if (i !== 3) {
            await nextTick();
        }
        expect(invokeMarker).toHaveBeenCalledTimes(4);
        expect(arr).toEqual([1, originRaw, 2, 2, 2, obj.$, 99]);

        --obj.$.b;
        if (i !== 3) {
            await nextTick();
        }
        expect(invokeMarker).toHaveBeenCalledTimes(5);
        expect(arr).toEqual([1, originRaw, 2, 2, 2, obj.$, 99, 98]);
    }
});

test("Whether a runtime warning will be caused when effect depends on no reactive value", () => {
    for (const effectFunc of reactiveEffectFuncs) {
        warningMatcher.mockClear();
        effectFunc(NOOP);
        expect(warningMatcher.args[2]).toBe(NOOP);
        expect(warningMatcher).toHaveBeenCalledTimes(1);
        expect(warningMatcher.args[1].startsWith("No reactive values were")).toBeTruthy();
    }

    for (const watchFunc of watchEffectFuncs) {
        warningMatcher.mockClear();
        watchFunc(NOOP, NOOP);
        expect(warningMatcher.args[2]).toBe(NOOP);
        expect(warningMatcher).toHaveBeenCalledTimes(1);
        expect(warningMatcher.args[1].startsWith("No reactive values were")).toBeTruthy();
        expect(warningMatcher.args[1].includes("that created with watcher")).toBeTruthy();
    }
});

test("Whether a runtime error will be caused when recursive update depth exceeds the maximum value", async () => {
    const errMsg = getErrorMessage(() => MaximumUpdateDepthExceeded());
    const stopGlobalErrorWatcher = matchGlobalError(errMsg, true);
    const v1 = react(0);
    for (let i = 0; i < 2; i++) {
        renderEffect(() => {
            if (v1.$ < 100) {
                arr.push(v1.$++);
            }
        });
    }
    expect(arr).toEqual([0, 1]);

    await nextTick();
    expect(arr.length).toBeGreaterThan(2);
    expect(arr.length).toBeLessThan(100);
    expect(arr).toEqual(makeConsecutiveNumbersArr(arr.length));

    await sleep(100);
    expect(arr).toEqual(makeConsecutiveNumbersArr(100));

    const v2 = (cleanup(), react(0));
    for (let i = 0; i < 2; i++) {
        renderEffect(() => {
            arr.push(v2.$++);
        });
    }
    expect(arr).toEqual([0, 1]);

    await sleep(100);
    stopGlobalErrorWatcher();
    expect(arr).toEqual(makeConsecutiveNumbersArr(303));
});

describe("Traversal operations of specified types are tracked as ITERATOR_KEYS dependencies", () => {
    test("Depend on Set", async () => {
        const set = constReact(new Set([1, 2, []]));
        renderEffect(() => {
            set.forEach((item: any, _: any, caller: any) => {
                if ((arr.push(item), isArray(item))) {
                    invokeMarker();
                    expect(isReactive(item)).toBeTruthy();
                }
                expect(caller).toBe(set);
            });
        });
        expect(arr).toEqual([1, 2, []]);
        expect(set[WRAPPER].a.size).toBe(2);
        expect(invokeMarker).toHaveBeenCalledTimes(1);
        expect(set[WRAPPER].a.has(ITERATOR_KEYS)).toBeTruthy();

        set.add(3);
        await nextTick();
        expect(arr).toEqual([1, 2, [], 1, 2, [], 3]);
        expect(invokeMarker).toHaveBeenCalledTimes(2);
        expect(set[WRAPPER].a.get(ITERATOR_KEYS).k.length).toBe(1);

        renderEffect(() => {
            for (const item of set) {
                if (isArray(item)) {
                    invokeMarker();
                    expect(isReactive(item)).toBeTruthy();
                }
            }
        });
        expect(invokeMarker).toHaveBeenCalledTimes(3);
        expect(set[WRAPPER].a.get(ITERATOR_KEYS).k.length).toBe(2);
    });

    test("Depend on Map", () => {
        const map = constReact(new Map());
        syncEffect(() => {
            map.forEach((value: any, key: any, caller: any) => {
                invokeMarker();
                arr.push([key, value]);
                expect(caller).toBe(map);
                expect(isNumber(key) || isReactive(key)).toBeTruthy();
                expect(isNumber(value) || isReactive(value)).toBeTruthy();
            });
        });
        expect(invokeMarker).toHaveBeenCalledTimes(0);

        map.set(1, 2);
        expect(invokeMarker).toHaveBeenCalledTimes(1);
    });

    test("Depend on Array", async () => {
        const nums = constReact([1, 2, []]);
        renderEffect(() => {
            nums.forEach((item: any, _: any, caller: any) => {
                if ((arr.push(item), isArray(item))) {
                    invokeMarker();
                    expect(isReactive(item)).toBeTruthy();
                }
                expect(caller).toBe(nums);
            });
        });
        expect(arr).toEqual([1, 2, []]);
        expect(nums[WRAPPER].a.size).toBe(2);
        expect(invokeMarker).toHaveBeenCalledTimes(1);
        expect(nums[WRAPPER].a.has(ITERATOR_KEYS)).toBeTruthy();

        ++nums[0];
        await nextTick();
        expect(arr).toEqual([1, 2, [], 2, 2, []]);
        expect(invokeMarker).toHaveBeenCalledTimes(2);

        nums.push(99);
        await nextTick();
        expect(arr.slice(6)).toEqual([2, 2, [], 99]);
        expect(invokeMarker).toHaveBeenCalledTimes(3);

        nums.pop();
        await nextTick();
        expect(arr.slice(10)).toEqual([2, 2, []]);
        expect(invokeMarker).toHaveBeenCalledTimes(4);
        expect(nums[WRAPPER].a.get(ITERATOR_KEYS).k.length).toBe(1);

        renderEffect(() => {
            for (const item of nums) {
                if (isArray(item)) {
                    invokeMarker();
                    expect(isReactive(item)).toBeTruthy();
                }
            }
        });
        expect(invokeMarker).toHaveBeenCalledTimes(5);
        expect(nums[WRAPPER].a.get(ITERATOR_KEYS).k.length).toBe(2);
    });
});

test("Whether updates keep working after a render effect throws", async () => {
    const source = react(0);
    const seen: number[] = [];
    let shouldThrow = false;

    renderEffect(() => {
        const value = source.$;
        if (shouldThrow) {
            throw new Error("effect boom");
        }
        seen.push(value);
    });
    expect(seen).toEqual([0]);

    source.$ = 1;
    await nextTick();
    expect(seen).toEqual([0, 1]);

    shouldThrow = true;
    await flushThrowingUpdate(() => (source.$ = 2));

    // 抛错只影响抛出它的那次更新，后续写入仍然会触发调度
    // A throw only affects the update it happened in; later writes are still scheduled.
    shouldThrow = false;
    source.$ = 3;
    await nextTick();
    expect(seen).toEqual([0, 1, 3]);
});

test("Whether the remaining effects of a batch run when one effect throws", async () => {
    const source = react(0);
    const seen: string[] = [];
    let shouldThrow = false;

    renderEffect(() => {
        const value = source.$;
        if (shouldThrow) {
            throw new Error("effect boom");
        }
        seen.push("first:" + value);
    });
    renderEffect(() => {
        seen.push("second:" + source.$);
    });
    expect(seen).toEqual(["first:0", "second:0"]);

    shouldThrow = true;
    await flushThrowingUpdate(() => (source.$ = 1));

    // 同一批中某个副作用抛错，不应阻止其余副作用执行
    // An effect throwing inside a batch must not prevent the remaining effects from running.
    expect(seen).toContain("second:1");
});

test("Whether the running effect context is restored when an effect throws", async () => {
    const source = react(0);
    let shouldThrow = false;

    renderEffect(() => {
        source.$;
        if (shouldThrow) {
            throw new Error("effect boom");
        }
    });

    shouldThrow = true;
    await flushThrowingUpdate(() => (source.$ = 1));

    // 运行栈必须还原，否则之后创建的绑定会挂到错误的 effect 上
    // The running stack must be restored, otherwise bindings created afterwards link to
    // the wrong effect.
    expect(activeEffect).toBe(NIL);
});

test("Whether the remaining sync effects run when one effect throws", () => {
    const source = react(0);
    const seen: string[] = [];
    let shouldThrow = false;

    syncEffect(() => {
        const value = source.$;
        if (shouldThrow) {
            throw new Error("sync effect boom");
        }
        seen.push("first:" + value);
    });
    syncEffect(() => {
        seen.push("second:" + source.$);
    });

    shouldThrow = true;
    expect(() => (source.$ = 1)).toThrow("sync effect boom");

    // 同步批在抛出前已经从队列摘下，同批其余副作用必须执行完毕
    // The sync batch is already dequeued, so the rest of it must finish before the error surfaces.
    expect(seen).toContain("second:1");
});

test("Whether the sync batch depth is restored when the batch throws", () => {
    const source = react(0);
    const seen: number[] = [];

    syncEffect(() => {
        seen.push(source.$);
    });
    expect(seen).toEqual([0]);

    expect(() =>
        batchUpdating(() => {
            throw new Error("batch boom");
        }),
    ).toThrow("batch boom");

    // 批深度未恢复时，同步副作用在后续所有写入中都不会再执行
    // If the batch depth were not restored, sync effects would never run on later writes.
    source.$ = 1;
    expect(seen).toEqual([0, 1]);
});

test("Whether scheduling resumes when a paused batch throws", () => {
    const source = react(0);
    const seen: number[] = [];

    syncEffect(() => {
        seen.push(source.$);
    });

    expect(() =>
        noUpdating(() => {
            source.$ = 1;
            throw new Error("paused boom");
        }),
    ).toThrow("paused boom");

    // 暂停深度未恢复时，之后的所有写入都不会再触发调度
    // If the pause depth were not restored, no later write would schedule anything.
    source.$ = 2;
    expect(seen).toEqual([0, 2]);
});

test("Whether a throwing cleanup still unregisters the effect", async () => {
    const source = react(0);
    const seen: number[] = [];
    const { handle } = effect(() => {
        seen.push(source.$);
        return () => {
            throw new Error("cleanup boom");
        };
    });

    expect(() => handle.stop()).toThrow("cleanup boom");

    source.$ = 1;
    await nextTick();
    // 清理函数抛错时副作用必须已经摘链并置位，不能再被调度
    // When the cleanup throws, the effect must already be unlinked and marked, so it can
    // never be scheduled again.
    expect(seen).toEqual([0]);
});

test("Whether a throwing cleanup runs only once and the effect keeps updating", async () => {
    const source = react(0);
    const seen: number[] = [];
    let cleanupCalls = 0;

    effect(() => {
        const value = source.$;
        seen.push(value);
        return () => {
            cleanupCalls++;
            if (value === 0) {
                throw new Error("cleanup boom");
            }
        };
    });
    expect(seen).toEqual([0]);
    expect(cleanupCalls).toBe(0);

    await flushThrowingUpdate(() => (source.$ = 1));

    // 清理函数抛错后：回调没有运行，清理函数已经摘下，不能在下一轮被重复执行
    // After the cleanup throws: the callback did not run and the cleanup was already
    // detached, so it must not run again on the next pass.
    expect(seen).toEqual([0]);
    expect(cleanupCalls).toBe(1);

    source.$ = 2;
    await nextTick();

    // 抛错没有让副作用卡在“调度中”，下一轮照常执行并安装新的清理函数
    // The throw did not leave the effect stuck in "scheduling": the next pass runs normally
    // and installs the new cleanup.
    expect(seen).toEqual([0, 2]);
    expect(cleanupCalls).toBe(1);

    source.$ = 3;
    await nextTick();
    expect(seen).toEqual([0, 2, 3]);
    expect(cleanupCalls).toBe(2);
});

test("Whether the watch callback is skipped when the previous cleanup throws", async () => {
    const source = react(0);
    const seen: string[] = [];
    let cleanupCalls = 0;

    watch(
        () => source.$,
        (pre, cur) => {
            seen.push(`${pre}->${cur}`);
            return () => {
                cleanupCalls++;
                if (cur === 1) {
                    throw new Error("cleanup boom");
                }
            };
        },
    );
    // 创建时只收集依赖，不调用监视回调
    expect(seen).toEqual([]);

    source.$ = 1;
    await nextTick();
    expect(seen).toEqual(["0->1"]);
    expect(cleanupCalls).toBe(0);

    await flushThrowingUpdate(() => (source.$ = 2));

    // 清理函数抛错时监视回调不执行（否则会以 undefined 作为新值调用用户代码），
    // 也不会安装新的清理函数
    // When the cleanup throws, the watch callback is not invoked (which would call user code
    // with `undefined` as the new value), and no new cleanup is installed.
    expect(seen).toEqual(["0->1"]);
    expect(cleanupCalls).toBe(1);

    source.$ = 3;
    await nextTick();

    // 恢复后的下一轮以上一条成功观察到的值作为旧值
    // The next successful pass uses the last successfully observed value as the old value.
    expect(seen).toEqual(["0->1", "1->3"]);
});

test("Whether a speculative render effect stays unreachable after it throws", async () => {
    const source = react(0);
    let calls = 0;

    expect(() =>
        renderEffect(() => {
            calls++;
            source.$;
            throw new Error("mount boom");
        }),
    ).toThrow("mount boom");

    source.$ = 1;
    await nextTick();
    // 池化的投机对象不能因为半途收集的链接被调度器唤醒
    // The pooled speculative object must not be woken by the links it collected half-way.
    expect(calls).toBe(1);
});

test("Whether the current instance is restored when a lifecycle hook throws", () => {
    const originalInstance = currentInstance;
    const instance = { _internal: { f: [], d: { l: 0 } } } as any;

    onBeforeDestroy(instance, () => {
        throw new Error("hook boom");
    });

    expect(() => runHooks(instance, BEFORE_DESTROY)).toThrow("hook boom");
    expect(currentInstance).toBe(originalInstance);
});

test("Whether the remaining lifecycle hooks run when one hook throws", () => {
    const originalInstance = currentInstance;
    const instance = { _internal: { f: [], d: { l: 0 } } } as any;
    const seen: string[] = [];

    onBeforeDestroy(instance, () => {
        seen.push("first");
        throw new Error("hook boom");
    });
    onBeforeDestroy(instance, () => {
        seen.push("second");
    });

    expect(() => runHooks(instance, BEFORE_DESTROY)).toThrow("hook boom");

    // 同一阶段的钩子相互独立，错误在全部执行完后才抛出
    // Hooks in the same phase are independent, and the error is thrown after all of them have run.
    expect(seen).toEqual(["first", "second"]);
    expect(currentInstance).toBe(originalInstance);
});

test("Whether the remaining effects run when an update hook throws", async () => {
    const originalDestruction = currentDestruction;
    const instance = { _internal: { f: [], l: 0 } } as any;
    const tracked = react(0);
    const seen: string[] = [];

    onBeforeUpdate(instance, () => {
        throw new Error("hook boom");
    });

    createDestruction(null, instance);
    renderEffect(() => {
        seen.push("first:" + tracked.$);
    });
    renderEffect(() => {
        seen.push("second:" + tracked.$);
    });
    setCurrentDestruction(originalDestruction);

    await flushThrowingUpdate(() => (tracked.$ = 1));

    // 组件的更新钩子失败不应阻止同批其余副作用执行
    // A component's update hook throwing must not prevent the remaining effects
    // in the same batch from running.
    expect(seen).toContain("second:1");
});

test("Whether the remaining cleanups run when a cleanup throws", () => {
    const parent = currentDestruction!;
    const nested = createDestruction(parent);
    const tracked = react(0);
    const seen: string[] = [];

    pushDestructionCleaner(() => {
        seen.push("first");
        throw new Error("cleanup boom");
    });
    pushDestructionCleaner(() => {
        seen.push("second");
    });
    syncEffect(() => {
        tracked.$;
        return () => {
            seen.push("effect");
        };
    });
    backToParentDestruction();

    expect(() => destroy(nested, false)).not.toThrow();

    // 清理项彼此独立，一个失败不影响其余项；结构收尾仍然完成，错误只在开发模式提示
    // Cleanups are independent: one failing does not affect the others,
    // and the destruction still completes, with the error only being warned in dev mode.
    expect(seen).toEqual(["first", "second", "effect"]);
    expect(nested.l & DST_DESTRUCTED).toBe(DST_DESTRUCTED);
    expect(nested.e).toBeNull();
    expect(warningMatcher.mock.calls.some(args => args.join(" ").includes("8006"))).toBe(true);
});
