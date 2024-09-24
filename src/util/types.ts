import type { EventListenerFlag, EventWrapperFlag } from "./shared"

export type ObjectKeys = string | number | symbol
export type AnyObject<V = any> = Record<ObjectKeys, V>

export type SetValue<S> = S extends Set<infer U> ? U : never
export type MapKeyType<M> = M extends Map<infer U, any> ? U : never
export type MapValueType<M> = M extends Map<any, infer U> ? U : never

export type EventWrapperFlagKeys = keyof typeof EventWrapperFlag
export type EventListenerFlagKeys = keyof typeof EventListenerFlag

export type FixedArray<T, L extends number, R extends T[] = []> = R["length"] extends L
    ? R
    : FixedArray<T, L, [...R, T]>

export interface FindOutOfSC {
    (str: string, pattern: string | RegExp): number
    (str: string, pattern: string | RegExp, startIndex: number): FixedArray<number, 2>
}
