import type { AnyObject } from "../util/types"
import type { IsModuleFunc } from "./constants"
import type { QingKuaiComponent } from "./instance"
import type { ReactivityWrapper } from "./reactivity/value"

export type ZeroOrOne = 0 | 1
export type AnySet = Set<any>
export type Getter = () => any
export type AnyMap = Map<any, any>
export type GeneralFunc = () => void
export type PartialNode = Node | null
export type Setter = (v: any) => void
export type ValueOrValueArr<T> = T | T[]
export type ObjectKeys = keyof AnyObject
export type Noop = (...params: any[]) => any
export type PartialGeneralFunc = GeneralFunc | null

export type Opportunity = "sync" | "pre" | "post"

export interface QingKuaiProperties {
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
export type QingKuaiComponentConstructonParam = {
    refs: QingKuaiProperties["refs"]
    props: QingKuaiProperties["props"]
    slots: QingKuaiProperties["slots"]
}

export type ComponentStructure = [
    typeof QingKuaiComponent,
    "",
    AttributeStructure | null,
    ReferenceStructure | null,
    ...SlotStructure[]
]
export type TemplateStructure =
    | [
          string,
          string | Function,
          AttributeStructure | null,
          EventStructure | null,
          ...TemplateStuOrModuleFunc[]
      ]
    | ComponentStructure

export type RenderStructure = {
    // means TemplateStructures Or ModuleFuncs
    toms: {
        module: ModuleFunc | null
        template: TemplateStructure | []
    }[]
    directive: Directive
}

export type ModuleFunc = {
    [IsModuleFunc]?: boolean
    (ctx: GetContextFunc, context: RenderContext[]): RenderStructure
}

export type GetContextFunc = (ci: number) => any
export type SlotStructure = [string, TemplateStuOrModuleFunc[]]
export type TemplateStuOrModuleFunc = TemplateStructure | ModuleFunc
export type AttributeStructure = [string, any, ...AttributeStructure[]]
export type EventStructure = [string, () => Function, number, ...EventStructure[]]
export type ReferenceStructure = [string, any, (v: any) => any, ...ReferenceStructure[]]

export type Directive = {
    t: number
    e: EffectListItem[]
    v: [number, any[][], DirectiveUpdateFuncGen]
} | null

export type RenderContext = {
    v: any[][]
    e: EffectListItem[]
}
export type UpdateFunc = {
    (): boolean
    called?: boolean
    instance?: QingKuaiComponent
}
export type KeyedInfoItem = {
    dst: DestructionStruct | null
    nks: (Node | KeyedInfo)[]
}
export type DirectiveUpdateFuncGen = (
    instance: QingKuaiComponent,
    directive: Directive,
    target: Node,
    derf: Text,
    context: RenderContext[],
    dst: DestructionStruct,
    dsta: DestructionStruct[],
    isKeyedTop: boolean,
    keyedInfo: KeyedInfo
) => UpdateFunc | null
export type KeyedInfo = KeyedInfoItem[]
export type UpdateFuncGenParams = Parameters<DirectiveUpdateFuncGen>

export type QingKuaiNodeStruct = {
    n: PartialNode
    text?: string
    attrs?: {
        [K: string]: any
    }
}
export type DestructionStruct = {
    v: GeneralFunc[]
    c: Set<DestructionStruct[]>
}

export interface WatchCallback<T> {
    (pre: T, cur: T): void
}
export interface WatchStruct {
    pre: any
    cur: any
    getter: Getter
    type: Opportunity
    fn: WatchCallback<any>
}
export interface EffectStruct {
    fn: GeneralFunc
    type: Opportunity
}
export type WatchEffectStruct = WatchStruct | EffectStruct
export type EffectListItem = [Set<UpdateFunc>, Set<WatchEffectStruct> | null]

export interface RuntimeWatchFunc {
    <T>(getter: () => T, callback: WatchCallback<T>): () => void
    <T>(expression: Exclude<T, Function>, callback: WatchCallback<T>): () => void
}

export type PGetHandler = ProxyHandler<any>["get"]
export type PSetHandler = ProxyHandler<any>["set"]
export type PDeleteHandler = ProxyHandler<any>["deleteProperty"]

export type WithBindNativeTarget = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
