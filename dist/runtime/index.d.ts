import { R as RuntimeWatchFunc, G as GeneralFunc, Q as QingKuaiComponent, a as QingKuaiComponentConstructonParam } from '../chunks/type.js';
export { c as onAfterDestroy, o as onAfterMount, b as onAfterUpdate, f as onBeforeDestroy, d as onBeforeMount, e as onBeforeUpdate, r as raw } from '../chunks/type.js';

declare const syncWatch: RuntimeWatchFunc;
declare const preWatch: RuntimeWatchFunc;
declare const watch: RuntimeWatchFunc;
declare const syncEffect: (callback: GeneralFunc) => () => void;
declare const preEffect: (callback: GeneralFunc) => () => void;
declare const effect: (callback: GeneralFunc) => () => void;

declare function createApp(Component: typeof QingKuaiComponent, options?: Partial<QingKuaiComponentConstructonParam>): {
    mount: (selector: string) => QingKuaiComponent | undefined;
};

declare function nextTick(fn?: () => void): Promise<any>;

export { createApp, effect, nextTick, preEffect, preWatch, syncEffect, syncWatch, watch };
