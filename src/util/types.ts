import type { EventListenerFlag, EventWrapperFlag, PositionFlag } from "./shared/flag"

export type NumNum = FixedArray<number, 2>

export type StartBracket = "{" | "[" | "("

export type ObjectKeys = string | number | symbol
export type AnyObject<V = any> = Record<ObjectKeys, V>
export type GeneralFunc<R = any> = (...args: any) => R

export type SetValue<S> = S extends Set<infer U> ? U : never
export type MapKeyType<M> = M extends Map<infer U, any> ? U : never
export type MapValueType<M> = M extends Map<any, infer U> ? U : never

export type PositionFlagKeys = keyof typeof PositionFlag
export type EventWrapperFlagKeys = keyof typeof EventWrapperFlag
export type EventListenerFlagKeys = keyof typeof EventListenerFlag

export type FixedArray<T, L extends number, R extends T[] = []> = R["length"] extends L
    ? R
    : FixedArray<T, L, [...R, T]>
