import { stringify } from "../../util/shared/aliases"
import { DEV_MODE, MAX_SCHEDULE_DEPTH } from "../constants"

export function NotPromise(purpose: string): never {
    throwErrorWithCode(
        2001,
        DEV_MODE ? `The given value for ${purpose} is not a Promise.` : "value is not a Promise"
    )
}

export function NonTraverse(): never {
    throwErrorWithCode(
        2002,
        DEV_MODE
            ? `The given value for "#for" directive is non-traversable.`
            : "#for source is non-traversable"
    )
}

export function NotArrayOrSet(attr: string, target: string): never {
    throwErrorWithCode(
        2006,
        DEV_MODE
            ? `The "${attr}" attribute value for ${target} must be an array or a set.`
            : "value must be an array or a set"
    )
}

export function CannotRenderComponent(): never {
    throwErrorWithCode(
        2007,
        DEV_MODE
            ? `Cannot render the component: the given value is neither a component function nor a promise resolving to a component function.`
            : "value is not a component function or a promise of one"
    )
}

export function DuplicateKey(key: unknown): never {
    throwErrorWithCode(
        2003,
        DEV_MODE
            ? `Duplicate value for "#key" directive, duplicate item: ${stringify(key)}.`
            : "duplicate #key value"
    )
}

export function InvalidElementNode(purpose: string): never {
    throwErrorWithCode(
        2005,
        DEV_MODE
            ? `Invalid Element node: the given value for ${purpose} is not a valid Element node or the corresponding Element node cannot be selected.`
            : `invalid Element node for ${purpose}`
    )
}

export function MaximumUpdateDepthExceeded(): never {
    throwErrorWithCode(
        2004,
        DEV_MODE
            ? `Maximum recursive update depth exceeded(max schedule depth is ${MAX_SCHEDULE_DEPTH}). This usually occurs because reactive values were modified within asynchronous side effects or watchers, leading to recursive update scheduling.`
            : `recursive update depth exceeded, max schedule depth is ${MAX_SCHEDULE_DEPTH}`
    )
}

function throwErrorWithCode(code: number, message: string): never {
    throw new TypeError(`${message} (${code})`)
}
