export declare const RENDER: unique symbol
export declare const EMPTY_SIGN: unique symbol

export declare const COMPONENT: unique symbol

export interface QingkuaiComponent<F extends ArbitraryFunc> {
    [RENDER]: F
}

export interface EmptyObject {
    [EMPTY_SIGN]?: never
}

type ArbitraryFunc = (...args: any) => any

export {}
