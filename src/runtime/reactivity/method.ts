import type { ObjectKeys } from "#type-declarations/tools"
import type { ReactiveMethods, ReactivityWrapper } from "#type-declarations/runtime"

import {
    WRAPPER,
    WRAPPER_MAP,
    WRAPPER_SET,
    WRAPPER_ARRAY,
    ITERATOR_KEYS,
    LINK_HAS_CHANGED,
    LINK_OWN_CHANGED,
    LINK_VALUE_CHANGED
} from "./constants"
import { scheduleUpdate } from "./schedule"
import { constReact, mutualLink } from "./value"
import { notEqual } from "../../util/shared/sundry"
import { isReactive, isShallow, couldReact } from "../../util/runtime/assert"
import { batchAndNoTracking, batchUpdateWithRaw, batchUpdating } from "./optimization"
import { ensureGetRefProperty, reverse, reactiveNotEqual } from "../../util/runtime/sundry"
import { isArrayLike, isObject, isSpreadable, isUndefined } from "../../util/shared/assert"

const commonMethodsForSetAndMap: ReactiveMethods[number] = {
    has(value) {
        return _has(this[WRAPPER], value, true)
    },
    clear() {
        return _batchUpdateWithRaw(this[WRAPPER], "clear")
    },
    delete(value) {
        return _addOrDelete(this[WRAPPER], value, "delete")
    },
    forEach(callback, thisArg) {
        _traverse(this[WRAPPER], "forEach", callback, thisArg)
    }
}

const iteratorMethods: ReactiveMethods[number] = {
    keys() {
        return _iterator(this[WRAPPER], "keys")
    },
    values() {
        return _iterator(this[WRAPPER], "values")
    },
    entries() {
        return _iterator(this[WRAPPER], "entries")
    },
    [Symbol.iterator]() {
        return _iterator(this[WRAPPER], Symbol.iterator)
    }
}

export const reactiveMethods: ReactiveMethods = {
    [WRAPPER_ARRAY]: {
        ...iteratorMethods,
        forEach: commonMethodsForSetAndMap.forEach,

        flat(depth = 1) {
            return _flat(this[WRAPPER], depth)
        },
        concat(...items) {
            return _concat(this[WRAPPER], ...items)
        },

        sort(compareFn) {
            return _sort(this[WRAPPER], "sort", compareFn)
        },
        toSorted(compareFn) {
            return _sort(this[WRAPPER], "toSorted", compareFn)
        },

        pop() {
            return _batchAndNoTracking(this[WRAPPER], "pop")
        },
        push(...values) {
            return _batchAndNoTracking(this[WRAPPER], "push", values)
        },

        indexOf(searchElement) {
            return _indexOf(this[WRAPPER], "indexOf", searchElement)
        },
        lastIndexOf(searchElement) {
            return _indexOf(this[WRAPPER], "lastIndexOf", searchElement)
        },

        find(predicate, thisArg) {
            return _find(this[WRAPPER], "find", predicate, thisArg)
        },
        findLast(predicate, thisArg) {
            return _find(this[WRAPPER], "findLast", predicate, thisArg)
        },

        reduce(callback, initialValue) {
            return _reduce(this[WRAPPER], "reduce", callback, initialValue)
        },
        reduceRight(callback, initialValue) {
            return _reduce(this[WRAPPER], "reduceRight", callback, initialValue)
        },

        toString() {
            return _linkIteratorKeys(this[WRAPPER], "toString")
        },
        toReversed() {
            return _linkIteratorKeys(this[WRAPPER], "toReversed")
        },
        join(separator) {
            return _linkIteratorKeys(this[WRAPPER], "join", separator)
        },
        toSpliced(start, deleteCount) {
            return _linkIteratorKeys(this[WRAPPER], "toSpliced", start, deleteCount)
        },

        map(callback, thisArg) {
            return _traverse(this[WRAPPER], "map", callback, thisArg)
        },
        flatMap(callback, thisArg) {
            return _traverse(this[WRAPPER], "flatMap", callback, thisArg)
        },
        every(predicate, thisArg) {
            return _traverse(this[WRAPPER], "every", predicate, thisArg)
        },
        filter(predicate, thisArg) {
            return _traverse(this[WRAPPER], "filter", predicate, thisArg)
        },
        findIndex(predicate, thisArg) {
            return _traverse(this[WRAPPER], "findIndex", predicate, thisArg)
        },
        findLastIndex(predicate, thisArg) {
            return _traverse(this[WRAPPER], "findLastIndex", predicate, thisArg)
        },

        shift() {
            return _batchUpdateWithRaw(this[WRAPPER], "shift")
        },
        reverse() {
            return _batchUpdateWithRaw(this[WRAPPER], "reverse")
        },
        fill(value) {
            return _batchUpdateWithRaw(this[WRAPPER], "fill", value)
        },
        unshift(...values) {
            return _batchUpdateWithRaw(this[WRAPPER], "unshift", ...values)
        },
        splice(start, deleteCount, ...items) {
            if (!deleteCount && !items.length) {
                return []
            }
            return _batchUpdateWithRaw(this[WRAPPER], "splice", start, deleteCount, ...items)
        }
    },
    [WRAPPER_SET]: {
        ...iteratorMethods,
        ...commonMethodsForSetAndMap,

        add(value) {
            return _addOrDelete(this[WRAPPER], value, "add")
        }
        // 待办：实现 union、difference 等集合方法
        // TODO: Implement set operations such as `union` and `difference`.
    },
    [WRAPPER_MAP]: {
        ...iteratorMethods,
        ...commonMethodsForSetAndMap,

        get(key) {
            return _get(this[WRAPPER], key, true)
        },
        set(key, value) {
            return _set(this[WRAPPER], key, value)
        }
        // 待办：实现 getOrInsert、getOrInsertComputed 等映射方法
        // TODO: Implement map operations such as `getOrInsert` and `getOrInsertComputed`.
    }
}

function _concat(wrapper: ReactivityWrapper, ...items: any) {
    const linkFlag = LINK_VALUE_CHANGED | LINK_OWN_CHANGED
    for (const item of items) {
        if (isReactive(item) && isSpreadable(item)) {
            const itemWrapper = item[WRAPPER]
            if (itemWrapper.l & WRAPPER_ARRAY) {
                mutualLink(itemWrapper, ITERATOR_KEYS, linkFlag)
            } else if (isArrayLike(item)) {
                for (let i = 0; i < item.length; i++) {
                    mutualLink(itemWrapper, "" + i, linkFlag)
                }
            }
        }
    }
    return _linkIteratorKeys(wrapper, "concat", ...items)
}

function _flat(wrapper: ReactivityWrapper, depth: number) {
    if (!isShallow(wrapper)) {
        ;(function track(wrapper, depth) {
            if (depth) {
                wrapper.p.forEach((item: any) => {
                    const w = item?.[WRAPPER]
                    if (w && w.l & WRAPPER_ARRAY) {
                        track(w, depth - 1)
                    }
                })
            }
        })(wrapper, depth)
    }
    return wrapper.r.flat(depth)
}

// Implements for: keys, values, entries, Symbol.iterator
function _iterator(wrapper: ReactivityWrapper, funcName: ObjectKeys) {
    const iterator = wrapper.r[funcName]()
    const linkFlag = wrapper.l & WRAPPER_ARRAY ? LINK_OWN_CHANGED : 0
    if (!isShallow(wrapper)) {
        iterator._next = iterator.next
        iterator.next = () => {
            const nextRet = iterator._next()
            if (couldReact(nextRet.value)) {
                nextRet.value = constReact(nextRet.value)
            }
            return nextRet
        }
    }
    return (mutualLink(wrapper, ITERATOR_KEYS, LINK_VALUE_CHANGED | linkFlag), iterator)
}

// Implements for: sort, toSorted
function _sort(wrapper: ReactivityWrapper, funcName: string, compareFn: any) {
    const callWith = funcName[0] == "t" ? _linkIteratorKeys : _batchUpdateWithRaw
    if (!compareFn) {
        return callWith(wrapper, funcName)
    }
    return callWith(wrapper, funcName, (a: any, b: any) => {
        if (!isShallow(wrapper)) {
            if (couldReact(a)) {
                a = constReact(a)
            }
            if (couldReact(b)) {
                b = constReact(b)
            }
        }
        return compareFn(a, b)
    })
}

// Implements for: pop, push
function _batchAndNoTracking(wrapper: ReactivityWrapper, funcName: string, args?: any) {
    return batchAndNoTracking(() => wrapper.r[funcName].apply(wrapper.p, args))
}

// Implements for: indexOf, lastIndexOf
function _indexOf(wrapper: ReactivityWrapper, funcName: string, searchElement: any) {
    const index = _linkIteratorKeys(wrapper, funcName, searchElement)
    if (index == -1 && !isShallow(wrapper) && isObject(searchElement)) {
        return wrapper.r[funcName](reverse(searchElement))
    }
    return index
}

// Implements for: clear, shift, reverse, fill, unshift, splice, sort
function _batchUpdateWithRaw(wrapper: ReactivityWrapper, funcName: string, ...args: any) {
    return batchUpdateWithRaw(wrapper.p, raw => {
        const ret = raw[funcName](...args)
        return ret === wrapper.r ? wrapper.p : ret
    })
}

// Implements for: join, toString, toRersed, toSpliced
function _linkIteratorKeys(wrapper: ReactivityWrapper, funcName: string, ...args: any) {
    mutualLink(wrapper, ITERATOR_KEYS, LINK_VALUE_CHANGED | LINK_OWN_CHANGED)
    return wrapper.r[funcName](...args)
}

// Implements for: find, findLast
function _find(wrapper: ReactivityWrapper, funcName: string, predicate: any, thisArg: any) {
    return wrapper.p[wrapper.p[funcName + "Index"](predicate, thisArg)]
}

// Implements for: forEach, map, flatMap, every, filter
function _traverse(wrapper: ReactivityWrapper, funcName: string, callback: any, thisArg: any) {
    if (!isUndefined(thisArg)) {
        callback = callback.bind(thisArg)
    }
    return _linkIteratorKeys(wrapper, funcName, (item: any, key: any) => {
        if (!isShallow(wrapper)) {
            if (couldReact(item)) {
                item = constReact(item)
            }
            if (!(wrapper.l & WRAPPER_ARRAY) && couldReact(key)) {
                key = constReact(key)
            }
        }
        return callback(item, key, wrapper.p)
    })
}

// Implements for: reduce, reduceRight
function _reduce(wrapper: ReactivityWrapper, funcName: string, callback: any, initialValue: any) {
    return _linkIteratorKeys(
        wrapper,
        funcName,
        (prev: any, cur: any, index: number) => {
            if (!isShallow(wrapper) && couldReact(cur)) {
                cur = constReact(cur)
            }
            return callback(prev, cur, index, wrapper.p)
        },
        initialValue
    )
}

function _get(wrapper: ReactivityWrapper, key: any, track = false) {
    if (track) {
        mutualLink(wrapper, key)
    }
    if (isShallow(wrapper)) {
        return wrapper.r.get(key)
    }
    return constReact(wrapper.r.get(wrapper.r.has(key) ? key : reverse(key)))
}

function _set(wrapper: ReactivityWrapper, key: any, value: any) {
    let scheduleFlag = 0
    const shallow = isShallow(wrapper)
    const hadKey = wrapper.r.has(key)
    const isChanged = shallow ? notEqual : reactiveNotEqual
    const hadReversedKey = !hadKey && !shallow && wrapper.r.has(reverse(key))
    if (!(hadKey || hadReversedKey)) {
        if (!isUndefined(value)) {
            scheduleFlag |= LINK_VALUE_CHANGED
        }
        wrapper.r.set(key, value)
        scheduleFlag |= LINK_HAS_CHANGED
    } else if (isChanged(_get(wrapper, key), value)) {
        scheduleFlag |= LINK_VALUE_CHANGED
        wrapper.r.set(hadKey ? key : reverse(key), value)
    }
    if (scheduleFlag) {
        batchUpdating(() => {
            if (!shallow && isObject(key)) {
                scheduleUpdate(wrapper, reverse(key), scheduleFlag)
            }
            if (scheduleFlag & LINK_HAS_CHANGED) {
                scheduleUpdate(wrapper, ensureGetRefProperty("size"))
            }
            scheduleUpdate(wrapper, key, scheduleFlag)
        })
    }
    return wrapper.p
}

function _has(wrapper: ReactivityWrapper, key: any, track = false): boolean {
    let result = wrapper.r.has(key)
    if (!result && !isShallow(wrapper) && isObject(key)) {
        result = wrapper.r.has(reverse(key))
    }
    if (track) {
        mutualLink(wrapper, key, LINK_HAS_CHANGED)
    }
    return result
}

function _addOrDelete(wrapper: ReactivityWrapper, value: any, method: "add" | "delete") {
    const isAdd = method == "add"
    const shallow = isShallow(wrapper)
    if (isAdd != _has(wrapper, value)) {
        let scheduleFlag = LINK_HAS_CHANGED
        if (!isUndefined(wrapper.l & WRAPPER_SET ? value : _get(wrapper, value))) {
            scheduleFlag |= LINK_VALUE_CHANGED
        }
        if (!shallow && !isAdd) {
            wrapper.r[method](reverse(value))
        }
        wrapper.r[method](value)

        batchUpdating(() => {
            if (!shallow && isObject(value)) {
                scheduleUpdate(wrapper, reverse(value), scheduleFlag)
            }
            scheduleUpdate(wrapper, value, scheduleFlag)
            scheduleUpdate(wrapper, ensureGetRefProperty("size"))
        })
    }
    return wrapper.p
}
