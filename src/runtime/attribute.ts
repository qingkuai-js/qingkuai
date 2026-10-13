import type { AnyObject } from "#type-declarations/tools"
import type { ClassAttrValue } from "#type-declarations/runtime"

import { getElementValue } from "./dom"
import { NotArrayOrSet } from "./messages/error"
import { objectKeys } from "../util/shared/aliases"
import { any, notEqual, optc } from "../util/shared/sundry"
import { nextTick, reactiveNotEqual } from "../util/runtime/sundry"
import { ATTRIBUTE_PREFIX, XLINK_NAMESPACE_URI } from "./constants"
import { isArray, isBoolean, isNull, isString, isUndefined } from "../util/shared/assert"

// 属性缓存键会被频繁用作 DOM 元素上的扩展属性名，缓存字符串拼接结果
// 可以避免每次访问都为属性名重新分配字符串
// The cache keys are used as expando property names on DOM elements on hot
// paths; memoizing the concatenation avoids re-allocating the name every time.
const attributeCacheKeys = new Map<string, string>()

function attributeCacheKey(name: string) {
    let key = attributeCacheKeys.get(name)
    if (key === undefined) {
        key = ATTRIBUTE_PREFIX + name
        attributeCacheKeys.set(name, key)
    }
    return key
}

function getAttribute(elem: Element, name: string) {
    return elem.getAttribute(name) ?? ""
}

export function setClassName(elem: Element, value: ClassAttrValue) {
    const className = isString(value) ? value : getClassNameString(value)
    // 与元素上实际的类名比较：元素首次挂载且类名未变化时完全不需要触碰 DOM
    // Compare against the class actually present on the element: on first mount
    // (and whenever the class did not change) this avoids any DOM mutation.
    if (getAttribute(elem, "class") === className) {
        return
    }
    if (className) {
        elem.className = className
    } else {
        elem.removeAttribute("class")
    }
}

export function setAttribute(elem: Element, name: string, value: any) {
    const cacheKey = attributeCacheKey(name)
    if (!reactiveNotEqual(any(elem)[cacheKey], value)) {
        return
    }
    any(elem)[cacheKey] = value

    if (isNull(value) || isUndefined(value)) {
        elem.removeAttribute(name)
        return
    }

    if (name in elem) {
        try {
            any(elem)[name] = value
            return
        } catch {
            // do nothing
        }
    }
    if (isBoolean(value)) {
        if (value) {
            value = ""
        } else {
            elem.removeAttribute(name)
            return
        }
    }
    elem.setAttribute(name, value)
}

export function setXlinkAttribute(elem: Element, name: string, value: any) {
    const localName = name
    const qualifiedName = "xlink:" + localName
    const key = attributeCacheKey(qualifiedName)
    if (!reactiveNotEqual(any(elem)[key], value)) {
        return
    }
    any(elem)[key] = value

    if (isNull(value) || isUndefined(value) || value === false) {
        elem.removeAttributeNS(XLINK_NAMESPACE_URI, localName)
        return
    }

    if (isBoolean(value)) {
        value = ""
    }
    elem.setAttributeNS(XLINK_NAMESPACE_URI, qualifiedName, value)
}

export function setInputGroup(elem: HTMLInputElement, target: any) {
    const type = optc(target)
    const containerIsArray = type === "Array"
    if (!containerIsArray && type !== "Set") {
        return NotArrayOrSet("group", `<input>(radio/checkbox)`)
    }
    setAttribute(
        elem,
        "checked",
        target[containerIsArray ? "includes" : "has"](getElementValue(elem))
    )
}

export function setSelectValue(elem: HTMLSelectElement, target: any) {
    nextTick(() => {
        const options = elem.options ?? []
        if (!elem.multiple) {
            if (notEqual(target, getElementValue(elem))) {
                for (const option of options) {
                    option.selected = !notEqual(target, getElementValue(option))
                }
                any(elem)[attributeCacheKey("value")] = target
            }
        } else {
            const containerIsArray = isArray(target)
            if (!containerIsArray && optc(target) !== "Set") {
                return NotArrayOrSet("value", "<select multiple>")
            }
            for (const option of options) {
                setAttribute(
                    option,
                    "selected",
                    target[containerIsArray ? "includes" : "has"](getElementValue(option))
                )
            }
        }
    })
}

function getClassNameWithObject(o: AnyObject) {
    let className = ""
    for (const key of objectKeys(o)) {
        if (isString(key) && o[key]) {
            className += (className ? " " : "") + key
        }
    }
    return className
}

function getClassNameString(value: any): string {
    if (isString(value)) {
        return value
    }
    if (isArray(value)) {
        let className = ""
        for (let i = 0; i < value.length; i++) {
            className += getClassNameString(value[i])
            if (i < value.length - 1) {
                className += " "
            }
        }
        return className
    }
    return getClassNameWithObject(value)
}
