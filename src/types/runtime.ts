import type {
    Getter,
    AnyObject,
    FixedArray,
    ObjectKeys,
    GeneralFunc,
    ArbitraryFunc
} from "#type-declarations/tools"
import type { CANCELABLE } from "../runtime/directives/constants"
import type { WRAPPER, REF_PROPERTY_ID } from "../runtime/reactivity/constants"

interface WatchEffectExtra {
    v: any // target value
    g: Getter // getter getter
    f: WatchEffectCallback<any>
}

interface GeneralEffectExtra {
    f: GeneralEffectFunc
}

interface CancelablePromiseExtra {
    cancel: GeneralFunc
    [CANCELABLE]: boolean
}

export interface PropertyInfo {
    v: any // value
    l: number // flag
    k: number // link flag
}

export interface TraverseInfo {
    v: any // base value
    l: number // flag
    t: number // type
    h: number // length
    k: any[] | null // keys
}

export interface ComponentInstance {
    u: boolean // updating
    d: Destruction | null // destruction
    p: ComponentInstance | null // parent
    h: FixedArray<GeneralFunc[] | undefined, 6> // hooks
}

export interface NodeContext {
    a: Record<string, any> // attributes
    e: Record<string, [ArbitraryFunc, number?]> // delegated events
}

export interface BaseEffect {
    i: number // id
    l: number // flag
    t: number // timing
    k: Link[] // dependencies
    d: Destruction | null // destruction
    m: ComponentInstance | null // component
    c: GeneralFunc | null // cleaner between two runs
}

export interface Destruction {
    e: Effect[] | null // effects
    p: Destruction | null // parent
    l: GeneralFunc[] | null // cleaners
    c: Set<Destruction> | null // children
    m: ComponentInstance | null // component
    n: FixedArray<ChildNode | null, 2> // start and end nodes
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

export type ProxyWrapper = BaseWrapper & ProxyWrapperExtra
export type ReactivityWrapper = ProxyWrapper | AccessorWrapper
export type AccessorWrapper = BaseWrapper & AccessorWrapperExtra
export type WrapperExtra = AccessorWrapperExtra | ProxyWrapperExtra

export type DestructuringFunc = (target: any) => any[]
export type HookFunc = (callback: GeneralFunc) => void
export type CancelablePromise = Promise<any> & CancelablePromiseExtra

export type Effect = BaseEffect & EffectExtra
export type WatchEffect = BaseEffect & WatchEffectExtra
export type GeneralEffectFunc = () => void | GeneralFunc
export type EffectExtra = GeneralEffectExtra | WatchEffectExtra
export type WatchEffectCallback<T> = (pre: T, cur: T) => void | GeneralFunc

export interface ComponentContext {
    r: any[] // refs
    p: any[] // props
    s: any[] // slots
    R?: any // default refs
    P?: any // default props
    e?: string[] // delegated events
}
export type HtmlBlockOptions = Partial<{
    escapeTags: string[]
    escapeStyle: boolean
    escapeScript: boolean
}>
export type ComponentFunc = (anchor: Text, options?: ComponentContext) => void
export type ClassAttrValue = (string | Record<string, any>)[] | Record<string, any> | string
