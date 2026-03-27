import {
    KEY_UP,
    KEY_TAB,
    KEY_LEFT,
    KEY_DOWN,
    KEY_RIGHT,
    KEY_ENTER,
    KEY_ESCAPE,
    KEY_SPACE,
    KEY_DELETE
} from "../util/shared/flags"

// aliases
export const NIL = null
export const NOOP = () => {}
export const UNDEF = undefined
export const TOARRAY = (v: any) => [v]

export const OBJECT = Object
export const REFLECT = Reflect
export const RESOLVED = Promise.resolve()
export const OBJECT_PROTO = OBJECT.prototype
export const DOCUMENT = typeof document === "undefined" ? UNDEF : document

export const BEFORE_MOUNT = 0
export const AFTER_MOUNT = 1
export const BEFORE_UPDATE = 2
export const AFTER_UPDATE = 3
export const BEFORE_DESTROY = 4
export const AFTER_DESTROY = 5

// sundry
export const KEY_FLAG_MAP = {
    " ": KEY_SPACE,
    Tab: KEY_TAB,
    Enter: KEY_ENTER,
    Delete: KEY_DELETE,
    Escape: KEY_ESCAPE,
    ArrowUp: KEY_UP,
    ArrowDown: KEY_DOWN,
    ArrowLeft: KEY_LEFT,
    ArrowRight: KEY_RIGHT
}

// symbols
export const NODE_CONTEXT = Symbol("qk: nodecontext")
export const FRAGMENT_FLAG = Symbol("qk: fragment flag")
