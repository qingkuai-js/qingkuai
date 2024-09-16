type AnyObject = Record<ObjectKeys, any>;
type ObjectKeys = string | number | symbol;

declare const nil: null;
declare const noop: Noop;
declare const IsModuleFunc: unique symbol;

declare const react: (target?: any, los?: number | Setter, eol?: EffectListItem | number) => any;
declare const constReact: (target?: any, los?: number | Setter, eol?: EffectListItem | number) => any;
declare const destructuringReact: (dfnAndSetters: [(v: any) => any[], ...Setter[]], value: any, level?: number) => any[];
declare const constDestructuringReact: (dfnAndSetters: [(v: any) => any[], ...Setter[]], value: any, level?: number) => any[];
declare class ReactivityWrapper {
    raw: any;
    level: number;
    typeFlag: number;
    debugSetter: Setter;
    proxy: any;
    effect: EffectListItem;
    constructor(raw: any, level: number, typeFlag: number, debugSetter: Setter, initEffect?: EffectListItem);
    get: PGetHandler;
    set: PSetHandler;
    deleteProperty: PDeleteHandler;
}
declare function raw<T extends AnyObject>(v: T): T;

type Getter = () => any;
type GeneralFunc = () => void;
type Setter = (v: any) => void;
type ValueOrValueArr<T> = T | T[];
type Noop = (...params: any[]) => any;
type Opportunity = "sync" | "pre" | "post";
interface QingKuaiProperties {
    updating: boolean;
    ctx: GetContextFunc;
    hooks: GeneralFunc[][];
    dst: DestructionStruct;
    context: RenderContext[];
    deps: ReactivityWrapper[];
    ts: TemplateStuOrModuleFunc[];
    props: Record<string, (ctx: GetContextFunc) => any>;
    slots: Record<string | number, TemplateStuOrModuleFunc[]>;
    refs: Record<string, [(ctx: GetContextFunc) => any, (v: any, ctx: GetContextFunc) => any]>;
}
type QingKuaiComponentConstructonParam = {
    refs: QingKuaiProperties["refs"];
    props: QingKuaiProperties["props"];
    slots: QingKuaiProperties["slots"];
};
type ComponentStructure = [
    typeof QingKuaiComponent,
    "",
    AttributeStructure | null,
    ReferenceStructure | null,
    ...SlotStructure[]
];
type TemplateStructure = [
    string,
    string | Function,
    AttributeStructure | null,
    EventStructure | null,
    ...TemplateStuOrModuleFunc[]
] | ComponentStructure;
type RenderStructure = {
    toms: {
        module: ModuleFunc | null;
        template: TemplateStructure | [];
    }[];
    directive: Directive;
};
type ModuleFunc = {
    [IsModuleFunc]?: boolean;
    (ctx: GetContextFunc, context: RenderContext[]): RenderStructure;
};
type GetContextFunc = (ci: number) => any;
type SlotStructure = [string, TemplateStuOrModuleFunc[]];
type TemplateStuOrModuleFunc = TemplateStructure | ModuleFunc;
type AttributeStructure = [string, any, ...AttributeStructure[]];
type EventStructure = [string, () => Function, number, ...EventStructure[]];
type ReferenceStructure = [string, any, (v: any) => any, ...ReferenceStructure[]];
type Directive = {
    t: number;
    e: EffectListItem[];
    v: [number, any[][], DirectiveUpdateFuncGen];
} | null;
type RenderContext = {
    v: any[][];
    e: EffectListItem[];
};
type UpdateFunc = {
    (): boolean;
    called?: boolean;
    instance?: QingKuaiComponent;
};
type KeyedInfoItem = {
    dst: DestructionStruct | null;
    nks: (Node | KeyedInfo)[];
};
type DirectiveUpdateFuncGen = (instance: QingKuaiComponent, directive: Directive, target: Node, derf: Text, context: RenderContext[], dst: DestructionStruct, dsta: DestructionStruct[], isKeyedTop: boolean, keyedInfo: KeyedInfo) => UpdateFunc | null;
type KeyedInfo = KeyedInfoItem[];
type DestructionStruct = {
    v: GeneralFunc[];
    c: Set<DestructionStruct[]>;
};
interface WatchCallback<T> {
    (pre: T, cur: T): void;
}
interface WatchStruct {
    pre: any;
    cur: any;
    getter: Getter;
    type: Opportunity;
    fn: WatchCallback<any>;
}
interface EffectStruct {
    fn: GeneralFunc;
    type: Opportunity;
}
type WatchEffectStruct = WatchStruct | EffectStruct;
type EffectListItem = [Set<UpdateFunc>, Set<WatchEffectStruct> | null];
interface RuntimeWatchFunc {
    <T>(getter: () => T, callback: WatchCallback<T>): () => void;
    <T>(expression: Exclude<T, Function>, callback: WatchCallback<T>): () => void;
}
type PGetHandler = ProxyHandler<any>["get"];
type PSetHandler = ProxyHandler<any>["set"];
type PDeleteHandler = ProxyHandler<any>["deleteProperty"];

declare class QingKuaiComponent {
    /**
     * - ts means Template Structure
     * - deps means all Dependencies of component
     * - dst means Destruction Methods of component
     * - hooks in order: onBeforeMount, onAfterMount,
     *   onBeforeUpdate, onAfterUpdate, onBeforeDestroy, onAfterDestroy
     */
    __: QingKuaiProperties;
    constructor(args: QingKuaiComponentConstructonParam);
}
declare const onBeforeMount: (fn: GeneralFunc) => void;
declare const onAfterMount: (fn: GeneralFunc) => void;
declare const onBeforeUpdate: (fn: GeneralFunc) => void;
declare const onAfterUpdate: (fn: GeneralFunc) => void;
declare const onBeforeDestroy: (fn: GeneralFunc) => void;
declare const onAfterDestroy: (fn: GeneralFunc) => void;

export { type EventStructure as E, type GeneralFunc as G, type ModuleFunc as M, QingKuaiComponent as Q, type RuntimeWatchFunc as R, type Setter as S, type TemplateStuOrModuleFunc as T, type ValueOrValueArr as V, type QingKuaiComponentConstructonParam as a, onAfterUpdate as b, onAfterDestroy as c, onBeforeMount as d, onBeforeUpdate as e, onBeforeDestroy as f, type GetContextFunc as g, noop as h, react as i, constReact as j, destructuringReact as k, constDestructuringReact as l, nil as n, onAfterMount as o, raw as r };
