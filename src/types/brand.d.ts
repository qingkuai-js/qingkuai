export declare const RENDER: unique symbol
export declare const EMPTY_SIGN: unique symbol

export declare const COMPONENT: unique symbol

export type QingkuaiComponent<F extends ArbitraryFunc> = {
    [RENDER]: Parameters<F>[0] extends unknown ? ArbitraryFunc : F
}

export interface EmptyObject {
    [EMPTY_SIGN]?: never
}

type ArbitraryFunc = (...args: any) => any

export {}
