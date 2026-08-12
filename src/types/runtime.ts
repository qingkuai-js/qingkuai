import type {
    Getter,
    Setter,
    Prettify,
    AnyObject,
    ObjectKeys,
    GeneralFunc,
    ArbitraryFunc
} from "#type-declarations/tools"
import type { CANCELABLE } from "../runtime/directives/constants"
import type { WRAPPER, REF_PROPERTY_ID } from "../runtime/reactivity/constants"

interface CancelablePromiseExtra {
    cancel: GeneralFunc
    [CANCELABLE]: boolean
}

declare const RENDER: unique symbol

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
    updating: boolean
    hooks: GeneralFunc[][]
    parent: ComponentInstanceBase | null

    /** @internal */
    _internal: ComponentInstanceInternal
}

export type ComponentInstanceInternal = Partial<{
    d: Destruction
    D: DefaultValues // defaults
    s: AnyObject // raw slots
    h: Setter // handle setter
    p: AnyObject // raw props
    P: AnyObject // bound props
    r: AnyObject // raw refs
    R: AnyObject // bound refs
    e: string[] // delegated events
    a: string[] // ancestor scope chain
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

export type QingkuaiComponent<F extends ArbitraryFunc> = {
    [RENDER]: F
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
export type WatcherCallback<T> = (pre: T, cur: T) => void | GeneralFunc
export type EffectHandle = Record<"stop" | "pause" | "resume", GeneralFunc>

export type ComponentFunc = (
    anchor: Text,
    context?: ComponentInstanceInternal
) => ComponentInstance<QingkuaiComponent<any>>
export type ComponentInstance<T extends QingkuaiComponent<any>> = Prettify<
    ComponentInstanceBase & Readonly<ReturnType<T[typeof RENDER]>>
>

export type DefaultValues = Partial<Record<"props" | "refs", AnyObject>>
export type ClassAttrValue = (string | Record<string, any>)[] | Record<string, any> | string
