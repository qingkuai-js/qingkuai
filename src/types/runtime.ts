import type {
    Getter,
    Setter,
    AnyObject,
    ObjectKeys,
    GeneralFunc,
    ArbitraryFunc
} from "#type-declarations/tools"
import type { CANCELABLE } from "../runtime/directives/constants"
import type { WRAPPER, REF_PROPERTY_ID } from "../runtime/reactivity/constants"
import type { COMPONENT, EMPTY_SIGN, QingkuaiComponent } from "@qingkuai/virtual/brand"
import type { ComponentContexts, ComponentExports, ComponentOfInstance } from "./runtime-ex"

interface CancelablePromiseExtra {
    cancel: GeneralFunc
    [CANCELABLE]: boolean
}

export interface PropertyInfo {
    v: any // value
    l: number // flag
    k: number // link flag
}

export interface Traversable {
    v: any // base value
    t: number // type
    l: number // length
    k: any[] | null // keys
}

export interface TraverseContext {
    m: any // current item
    x: any // current key/index
}

export interface TraverseInfo {
    d: Destruction
    c: TraverseContext
    s: Setter | undefined
}

export interface ComponentInstanceBase {
    host: Element
    parent: ComponentInstanceBase | null

    /** @internal */
    _internal: ComponentMeta
}

export type ComponentMeta = Partial<{
    d: Destruction
    l: number // flag
    D: DefaultValues // defaults
    s: AnyObject // raw slots
    h: Setter // handle setter
    p: AnyObject // raw props
    P: AnyObject // bound props
    r: AnyObject // raw refs
    c: AnyObject // contexts
    R: AnyObject // bound refs
    e: string[] // delegated events
    a: string[] // ancestor scope chain
    f: GeneralFunc[][] | null // lifecycle hooks
}>

export interface Effect {
    f: ArbitraryFunc
    i: number // id
    l: number // flag
    t: number // timing
    k: Link[] // dependencies
    x: number // index in Destruction.e
    d: Destruction | null // destruction
    c: GeneralFunc | null // cleaner between two runs
    g?: Getter // getter (WatchEffect)
    v?: any // value (WatchEffect)
}

export interface Destruction {
    d: boolean // disposed
    f: number // fragment flag
    e: Effect[] | null // effects
    p: Destruction | null // parent
    n: ChildNode | null // end node
    s: ChildNode | null // start node
    a: GeneralFunc[] | null // cleaners
    c: Destruction[] | null // children
    m: ComponentInstance<any> | null // component
}

export interface BaseWrapper {
    r: any // raw
    p: any // proxy
    l: number // flag
    o: ObjectKeys[] | null // own keys
    b: ReactivityWrapper | null // inherit by
    c: Set<ReactivityWrapper> | null // derived children
}

export interface Link {
    e: Effect
    l: number // flag
    i: number // index in Subscription.k
    s: Subscription // subscription which it belongs
}

export interface Subscription {
    k: Link[]
    l: number // flag
    w: ReactivityWrapper
    p: any // property of wrapper
    a: number // active link index
}

export interface AccessorWrapperExtra {
    s: Subscription | null // sync subscriptions
    a: Subscription | null // async subscriptions
}

export interface ProxyWrapperExtra {
    s: Map<any, Subscription> | null // sync subscriptions
    a: Map<any, Subscription> | null // async subscriptions
}

export type ReactiveValue<T extends AnyObject> = T & {
    [WRAPPER]: ReactivityWrapper
}

export type ReactiveMethods = Record<
    number,
    Record<ObjectKeys, ArbitraryFunc> & { [WRAPPER]?: any }
>
export type RefProperty = [typeof REF_PROPERTY_ID, ObjectKeys]

export type DestructuringFunc = (target: any) => any[]
export type ProxyWrapper = BaseWrapper & ProxyWrapperExtra
export type ReactivityWrapper = ProxyWrapper | AccessorWrapper
export type AccessorWrapper = BaseWrapper & AccessorWrapperExtra
export type WrapperExtra = AccessorWrapperExtra | ProxyWrapperExtra
export type CancelablePromise = Promise<any> & CancelablePromiseExtra

export type EffectCallback = () => void | GeneralFunc
export type WatchCallback<T> = (pre: T, cur: T) => void | GeneralFunc
export type EffectHandle = Record<"stop" | "pause" | "resume", GeneralFunc>

export type ComponentFunc = (
    anchor: Text,
    meta?: ComponentMeta
) => ComponentInstance<QingkuaiComponent<any>>

export type ComponentInstance<T extends QingkuaiComponent<any>> = ComponentInstanceBase &
    Readonly<ComponentExports<T>> & { [COMPONENT]?: T }

export type ComponentMember<T extends QingkuaiComponent<any>, K> =
    T extends QingkuaiComponent<infer F>
        ? F extends (ctx: infer C) => any
            ? K extends keyof C
                ? C[K]
                : any
            : any
        : any

export type DeclaredContextKeys<I extends ComponentInstance<any>> = Exclude<
    keyof InstanceContexts<I>,
    typeof EMPTY_SIGN
>
export type InstanceContexts<I extends ComponentInstance<any>> = ComponentContexts<
    ComponentOfInstance<I>
>

export type ClassAttrValue = ClassAttrValue[] | Record<string, any> | string
export type DefaultValues = Partial<Record<"props" | "refs" | "contexts", AnyObject>>

export type BoundLifecycleFunc = (callback: GeneralFunc) => void
export type BoundEffectFunc = (callback: EffectCallback) => EffectHandle
export type BoundWatchFunc = <T>(getter: Getter<T>, callback: WatchCallback<T>) => EffectHandle

export type BoundSetContextFunc<T extends QingkuaiComponent<any>> = [
    Exclude<keyof ComponentContexts<T>, typeof EMPTY_SIGN>
] extends [never]
    ? (key: never, value: never) => void
    : <K extends keyof ComponentContexts<T>>(key: K, value: ComponentContexts<T>[K]) => void

export type BoundSetContextGetterFunc<T extends QingkuaiComponent<any>> = [
    Exclude<keyof ComponentContexts<T>, typeof EMPTY_SIGN>
] extends [never]
    ? (key: never, getter: never) => void
    : <K extends keyof ComponentContexts<T>>(
          key: K,
          getter: Getter<ComponentContexts<T>[K]>
      ) => void
