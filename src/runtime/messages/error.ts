import type { ArbitraryFunc } from "#type-declarations/tools"

export const NotPromise = withCode(2001, (purpose: string) => {
    return `The given value for ${purpose} is not a Promise.`
})

export const NonTraverse = withCode(2002, () => {
    return "The given value for #for directive is non-traversable."
})

export const DuplicateKey = withCode(2003, (key: string) => {
    return `Duplicate value for #key directive, duplicate item: ${key}.`
})

export const InvalidElementNode = withCode(8005, (purpose: string) => {
    return `Invalid Element node: the given value for ${purpose} is not a valid Element node or the corresponding Element node cannot be selected.`
})

export const MaximumUpdateDepth = withCode(2004, () => {
    return `Maximum recursive update depth exceeded. This usually occurs because reactive values were modified within asynchronous side effects or watchers, leading to recursive update scheduling.`
})

function withCode<T extends ArbitraryFunc<string>>(code: number, getter: T) {
    return (...args: Parameters<T>): never => {
        throw new TypeError(`${getter(...args)} (${code})`)
    }
}
