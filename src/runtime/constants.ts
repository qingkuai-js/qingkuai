import type { HtmlBlockOptions } from "#type-declarations/runtime-ex"

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

export const ATTRIBUTE_PREFIX = "__qk__attr"
export const EVENT_FLAG = "__qk__event_flag"
export const DELEGATE_PREFIX = "__qk__delegate"
export const NODE_CONTEXT = "__qk__node_context"
export const FRAGMENT_FLAG = "__qk__fragment_flag"

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
export const KEY_NAME_FLAG =
    KEY_SPACE |
    KEY_TAB |
    KEY_ENTER |
    KEY_DELETE |
    KEY_ESCAPE |
    KEY_UP |
    KEY_DOWN |
    KEY_LEFT |
    KEY_RIGHT

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

export const DESTRUCT_HTML: HtmlBlockOptions = {
    escapeStyle: true,
    escapeScript: true,
    escapeTags: ["link", "iframe", "form"]
}
