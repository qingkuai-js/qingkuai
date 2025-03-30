import type { QingKuaiComponent } from "./instance"
import type { ReactivityWrapper } from "./reactivity/value"
import type { AnyObject, GeneralFunc } from "../util/types"
import type { IS_MODULE_FUNC, IS_WITH_REFERENCE_RET, INSTANTIATE_BY_H } from "./constants"

export type ZeroOrOne = 0 | 1
export type AnySet = Set<any>
export type Getter = () => any
export type AnyMap = Map<any, any>
export type PartialNode = Node | null
export type Setter = (v: any) => void
export type ValueOrValueArr<T> = T | T[]
export type ObjectKeys = keyof AnyObject
export type TopNodesItem = TopNodes[number]
export type Noop = (...params: any[]) => any
export type TopNodes = (Node | TopNodes)[][]
export type DestructuringFunc = (v: any) => any[]
export type PartialGeneralFunc = GeneralFunc | null

export type Opportunity = "sync" | "pre" | "post"

export type UnescapeOptions = Partial<{
    escapeTags: string[]
    escapeStyle: boolean
    escapeScript: boolean
    escapeEntities: boolean
}>

export interface QingKuaiProperties {
    id: string
    updating: boolean
    ctx: GetContextFunc
    hooks: GeneralFunc[][]
    dst: DestructionStruct
    context: RenderContext[]
    deps: ReactivityWrapper[]
    ts: TemplateStuOrModuleFunc[]
    props: Record<string, (ctx: GetContextFunc) => any>
    slots: Record<string | number, TemplateStuOrModuleFunc[]>
    refs: Record<string, [(ctx: GetContextFunc) => any, (v: any, ctx: GetContextFunc) => any]>
}
export interface QingKuaiComponentConstructonParam {
    sign?: typeof INSTANTIATE_BY_H
    refs: QingKuaiProperties["refs"]
    props: QingKuaiProperties["props"]
    slots: QingKuaiProperties["slots"]
}

export type NormalTemplateStructure = [
    string,
    string | GeneralFunc,
    AttributeStructure | null,
    EventStructure | null,
    ...TemplateStuOrModuleFunc[]
]
export type ComponentStructure = [
    typeof QingKuaiComponent,
    "",
    AttributeStructure | null,
    ReferenceStructure | null,
    ...SlotStructure[]
]
export type TemplateStructure = NormalTemplateStructure | ComponentStructure

export interface RenderStructure {
    directive: Directive
    toms: (TemplateStuOrModuleFunc | Node)[]
}

export interface ModuleFunc {
    [IS_MODULE_FUNC]?: boolean
    (ctx: GetContextFunc): RenderStructure
}

// 这里必须为NormalEventHandlerGetter也添加一个IsWithReferenceRet属性，
// 否则会导致ts类型推导失败，这样写使得此类型该属性恒为undefined，否则排除此类型
export interface NormalEventHandlerGetter {
    (): EventListener
    [IS_WITH_REFERENCE_RET]?: undefined
}
export interface RefEventHandlerGetterGen {
    (
        qkNode: QingKuaiNodeStruct,
        invokeGetter: (getter: Function) => any,
        attachUpdate: (fn: UpdateFunc) => void
    ): EventListener
    [IS_WITH_REFERENCE_RET]: boolean
}
export type EventHandlerGetter = NormalEventHandlerGetter | RefEventHandlerGetterGen

export type GetContextFunc = (ci: number) => any
export type SlotStructure = [string, TemplateStuOrModuleFunc[]]
export type TemplateStuOrModuleFunc = TemplateStructure | ModuleFunc
export type AttributeStructure = [string, any, ...AttributeStructure[]]
export type EventStructure = [string, EventHandlerGetter, number, ...EventStructure[]]
export type ReferenceStructure = [string, any, (v: any) => any, ...ReferenceStructure[]]

export type Directive = {
    t: number /** type */
    e: EffectListItem[]
    v: [
        number /** run times */,
        any[][] /** context */,
        DirectiveUpdateFuncGen /** update method generator */
    ]
} | null

export type RenderContext = {
    v: any[][]
    e: EffectListItem[]
}
export interface UpdateFunc {
    (): boolean
    called?: boolean
    instance?: QingKuaiComponent
}
export type DirectiveUpdateFuncGen = (
    instance: QingKuaiComponent,
    directive: Directive,
    target: Node,
    derf: Text,
    context: RenderContext[],
    dst: DestructionStruct,
    topNodes: TopNodes
) => UpdateFunc | null
export type UpdateFuncGenParams = Parameters<DirectiveUpdateFuncGen>

export type QingKuaiNodeStruct = {
    n: PartialNode
    text: string
    attrs: AnyObject
}
export type DestructionStruct = {
    v: GeneralFunc[]
    c: DestructionStruct[] /** children */
    p: DestructionStruct | null /** parent */
}

export type WatchCallback<T> = {
    (pre: T, cur: T): void
}
export interface WatchStruct {
    cur: any
    getter: Getter
    type: Opportunity
    fn: WatchCallback<any>
}
export interface EffectStruct {
    fn: GeneralFunc
    type: Opportunity
}

export interface DerivedTarget {
    $: any
}
export interface DerivedInternalState {
    dirty: boolean
    initialized: boolean
    effectList: EffectListItem[]
}

export interface RuntimeWatchFunc {
    <T>(getter: () => T, callback: WatchCallback<T>): () => void
}

export type WatchEffectStruct = WatchStruct | EffectStruct
export type EffectListItem = [Set<UpdateFunc>, Set<WatchEffectStruct> | null]

export type PGetHandler = ProxyHandler<any>["get"]
export type PSetHandler = ProxyHandler<any>["set"]
export type PDeleteHandler = ProxyHandler<any>["deleteProperty"]
