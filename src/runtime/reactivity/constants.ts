import type { AnyObject } from "#type-declarations/tools"

// aliases
export const TIMING_PRE = 1
export const TIMING_UNSET = 2
export const TIMING_POST = 3
export const TIMING_SYNC = 4

export const WRAPPER = "__qk__r_wrapper"
export const OWN_KEYS = "__qk__r_own_keys"
export const ITERATOR_KEYS = "__qk__r_iterator_keys"
export const REF_PROPERTY_ID = "__qk__r_ref_property_id"

// flags
export const PROP_IN = 1 << 0
export const PROP_HAS = 1 << 1
export const PROP_OWN = 1 << 2
export const PROP_ITERATOR = 1 << 3

export const WRAPPER_SET = 1 << 0
export const WRAPPER_MAP = 1 << 1
export const WRAPPER_ARRAY = 1 << 2
export const WRAPPER_OBJECT = 1 << 3
export const WRAPPER_PROXY = 1 << 4
export const WRAPPER_SHALLOW = 1 << 5

export const EFFECT_WATCH = 1 << 0
export const EFFECT_RENDER = 1 << 1
export const EFFECT_DERIVED = 1 << 2
export const EFFECT_DISABLED = 1 << 3
export const EFFECT_DISPOSED = 1 << 4
export const EFFECT_SCHEDULING = 1 << 5
export const EFFECT_DERIVED_DIRTY = 1 << 6
export const EFFECT_DERIVED_READING = 1 << 7

export const SUB_SCHEDULING = 1 << 0
export const SUB_IS_ITERATOR_KEY = 1 << 1

export const LINK_IN_CHANGED = 1 << 0
export const LINK_OWN_CHANGED = 1 << 1
export const LINK_HAS_CHANGED = 1 << 2
export const LINK_VALUE_CHANGED = 1 << 3

// sundry
export const PROTO_MAP: AnyObject = {
    [WRAPPER_SET]: Set.prototype,
    [WRAPPER_MAP]: Map.prototype,
    [WRAPPER_ARRAY]: Array.prototype
}
export const TYPE_FLAG_MAP: AnyObject = {
    Set: WRAPPER_SET,
    Map: WRAPPER_MAP,
    Array: WRAPPER_ARRAY
}
export const TIMINGS = [TIMING_UNSET, TIMING_PRE, TIMING_POST, TIMING_SYNC]
