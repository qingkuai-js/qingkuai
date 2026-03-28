import { stringify } from "../../util/shared/aliases"

export function NotPromise(purpose: string): never {
    throwErrorWithCode(2001, `The given value for ${purpose} is not a Promise.`)
}

export function NonTraverse(): never {
    throwErrorWithCode(2002, `The given value for "#for" directive is non-traversable.`)
}

export function NotArrayOrSet(attr: string, target: string): never {
    throwErrorWithCode(
        2006,
        `The "${attr}" attribute value for ${target} must be an array or a set.`
    )
}

export function DuplicateKey(key: string): never {
    throwErrorWithCode(
        2003,
        `Duplicate value for "#key" directive, duplicate item: ${stringify(key)}.`
    )
}

export function InvalidElementNode(purpose: string): never {
    throwErrorWithCode(
        2005,
        `Invalid Element node: the given value for ${purpose} is not a valid Element node or the corresponding Element node cannot be selected.`
    )
}

export function MaximumUpdateDepthExceeded(): never {
    throwErrorWithCode(
        2004,
        `Maximum recursive update depth exceeded. This usually occurs because reactive values were modified within asynchronous side effects or watchers, leading to recursive update scheduling.`
    )
}

function throwErrorWithCode(code: number, message: string): never {
    throw new TypeError(`${message} (${code})`)
}
