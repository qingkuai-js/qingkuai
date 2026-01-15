// aliases
export const NIL = null
export const NOOP = () => {}
export const UNDEF = undefined

export const OBJECT = Object
export const REFLECT = Reflect
export const DOCUMENT = document
export const RESOLVED = Promise.resolve()
export const OBJECT_PROTO = OBJECT.prototype

export const BEFORE_MOUNT = 0
export const AFTER_MOUNT = 1
export const BEFORE_UPDATE = 2
export const AFTER_UPDATE = 3
export const BEFORE_DESTROY = 4
export const AFTER_DESTROY = 5

// flags
export const EVENT_ONCE = 1 << 0
export const EVENT_STOP = 1 << 1
export const EVENT_SELF = 1 << 2
export const EVENT_PREVENT = 1 << 3
export const EVENT_CAPTURE = 1 << 4

export const KEY_TAB = 1 << 0
export const KEY_ENTER = 1 << 1
export const KEY_DELETE = 1 << 2
export const KEY_ESCAPE = 1 << 3
export const KEY_SPACE = 1 << 4
export const KEY_UP = 1 << 5
export const KEY_DOWN = 1 << 6
export const KEY_LEFT = 1 << 7
export const KEY_RIGHT = 1 << 8
export const KEY_META = 1 << 9
export const KEY_ALT = 1 << 10
export const KEY_CTRL = 1 << 11
export const KEY_SHIFT = 1 << 12
export const KEY_EXACT = 1 << 13

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
export const NODE_CONTEXT = Symbol("qk:node_context")
