import { DEV } from "../dev"
import { stringify } from "../../util/shared/aliases"

// 生产构建只保留简短、可检索的错误原因（原因 + 代码），完整的解释性文案仅在开发模式进入
// 产物。宿主把 `__qk__dev` 折叠为 false 后，三元表达式里的长文案分支会被一并移除。
// The production build keeps only a short, greppable reason (reason + code); the full
// explanatory text is bundled in development mode only. Once the host folds `__qk__dev`
// to false, the long-text branch of each ternary is removed together with it.

export function NotPromise(purpose: string): never {
    throwErrorWithCode(
        2001,
        DEV ? `The given value for ${purpose} is not a Promise.` : "value is not a Promise"
    )
}

export function NonTraverse(): never {
    throwErrorWithCode(
        2002,
        DEV ? `The given value for "#for" directive is non-traversable.` : "#for source is non-traversable"
    )
}

export function NotArrayOrSet(attr: string, target: string): never {
    throwErrorWithCode(
        2006,
        DEV
            ? `The "${attr}" attribute value for ${target} must be an array or a set.`
            : "value must be an array or a set"
    )
}

export function CannotRenderComponent(): never {
    throwErrorWithCode(
        2007,
        DEV
            ? `Cannot render the component: the given value is neither a component function nor a promise resolving to a component function.`
            : "value is not a component function or a promise of one"
    )
}

export function DuplicateKey(key: unknown): never {
    throwErrorWithCode(
        2003,
        DEV
            ? `Duplicate value for "#key" directive, duplicate item: ${stringify(key)}.`
            : "duplicate #key value"
    )
}

export function InvalidElementNode(purpose: string): never {
    throwErrorWithCode(
        2005,
        DEV
            ? `Invalid Element node: the given value for ${purpose} is not a valid Element node or the corresponding Element node cannot be selected.`
            : `invalid Element node for ${purpose}`
    )
}

export function MaximumUpdateDepthExceeded(): never {
    throwErrorWithCode(
        2004,
        DEV
            ? `Maximum recursive update depth exceeded(max schedule depth is ${__qk__max_schedule_depth}). This usually occurs because reactive values were modified within asynchronous side effects or watchers, leading to recursive update scheduling.`
            : `recursive update depth exceeded, max schedule depth is ${__qk__max_schedule_depth}`
    )
}

function throwErrorWithCode(code: number, message: string): never {
    throw new TypeError(`${message} (${code})`)
}
