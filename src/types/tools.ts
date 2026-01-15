export type ZeroOrOne = 0 | 1
export type OneOrMany<T> = T | T[]
export type GeneralFunc = () => void
export type Getter<T = any> = () => T
export type Pair<T> = FixedArray<T, 2>
export type Setter<T = any> = (v: T) => void
export type ObjectKeys = string | number | symbol
export type AnyObject<V = any> = Record<ObjectKeys, V>
export type RegExpExecRet = ReturnType<RegExp["exec"]>
export type ArbitraryFunc<R = any> = (...args: any) => R

export type SetValue<S> = S extends Set<infer U> ? U : never
export type MapKeyType<M> = M extends Map<infer U, any> ? U : never
export type MapValueType<M> = M extends Map<any, infer U> ? U : never

export type RequiredNonNullableKeys<T, K extends keyof T> = Omit<T, K> &
    NonNullable<Required<Pick<T, K>>>
export type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

export type FixedArray<T, L extends number, R extends T[] = []> = R["length"] extends L
    ? R
    : FixedArray<T, L, [...R, T]>
