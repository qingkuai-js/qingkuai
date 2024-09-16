import { Q as QingKuaiComponent, T as TemplateStuOrModuleFunc, g as GetContextFunc, G as GeneralFunc, S as Setter, E as EventStructure, M as ModuleFunc, V as ValueOrValueArr } from '../chunks/type.js';
export { l as constDestructuringReact, j as constReact, k as destructuringReact, n as nil, h as noop, i as react } from '../chunks/type.js';

declare function init(instance: QingKuaiComponent): {
    setTemplateStructure(ts: TemplateStuOrModuleFunc[]): void;
    slots: Record<string | number, TemplateStuOrModuleFunc[]>;
    props: Record<string, (ctx: GetContextFunc) => any>;
    refs: Record<string, [(ctx: GetContextFunc) => any, (v: any, ctx: GetContextFunc) => any]>;
};

declare const derived: (fn: GeneralFunc, setter?: Setter | undefined) => any;

declare function eventWrapper(fn: EventListener, flag?: number, other?: string): EventListener;
declare function withReference(eventName: string, v: any, setter: (v: any) => void): EventStructure;

declare function aliasModule(rules: any[], ...toms: TemplateStuOrModuleFunc[]): ModuleFunc;
declare function ifModule(deps: any[], ...toms: ValueOrValueArr<TemplateStuOrModuleFunc>[]): ModuleFunc;
declare function forModule(dep: any, ...toms: TemplateStuOrModuleFunc[]): ModuleFunc;
declare function keyedForModule(dep1: any, dep2: any, ...toms: TemplateStuOrModuleFunc[]): ModuleFunc;
declare function awaitModule(dep: any, ...toms: ValueOrValueArr<TemplateStuOrModuleFunc | null>[]): ModuleFunc;

export { QingKuaiComponent, aliasModule, awaitModule, derived, eventWrapper, forModule, ifModule, init, keyedForModule, withReference };
