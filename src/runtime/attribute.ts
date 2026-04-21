import type { AnyObject } from "#type-declarations/tools"
import type { ClassAttrValue } from "#type-declarations/runtime"

import { getElementValue } from "./dom"
import { NotArrayOrSet } from "./messages/error"
import { objectKeys } from "../util/shared/aliases"
import { any, notEqual, optc } from "../util/shared/sundry"
import { nextTick, reactiveNotEqual } from "../util/runtime/sundry"
import { ATTRIBUTE_PREFIX, XLINK_NAMESPACE_URI } from "./constants"
import { isArray, isBoolean, isNull, isString, isUndefined } from "../util/shared/assert"

export function setClassName(elem: HTMLElement, value: ClassAttrValue) {
    let className = ""
    if (isString(value)) {
        className = value
    } else if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            if (isString(value[i])) {
                className += value[i]
            } else {
                className += getClassNameWithObject(value[i])
            }
            if (i < value.length - 1) {
                className += " "
            }
        }
    } else {
        className += getClassNameWithObject(value)
    }

    if (className != any(elem)[ATTRIBUTE_PREFIX + "class"]) {
        if (!className) {
            elem.removeAttribute("class")
        } else {
            elem.className = className
        }
        any(elem)[ATTRIBUTE_PREFIX + "class"] = className
    }
}

export function setAttribute(elem: HTMLElement, name: string, value: any) {
    if (!reactiveNotEqual(any(elem)[ATTRIBUTE_PREFIX + name], value)) {
        return
    }
    any(elem)[ATTRIBUTE_PREFIX + name] = value

    if (shouldRemoveAttribute(value)) {
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
        value = ""
    }
    elem.setAttribute(name, value)
}

export function setXlinkAttribute(elem: HTMLElement, name: string, value: any) {
    const localName = name
    const qualifiedName = "xlink:" + localName
    const key = ATTRIBUTE_PREFIX + qualifiedName
    if (!reactiveNotEqual(any(elem)[key], value)) {
        return
    }
    any(elem)[key] = value

    if (shouldRemoveAttribute(value)) {
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
                any(elem)[ATTRIBUTE_PREFIX + "value"] = target
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

function shouldRemoveAttribute(value: any) {
    return isNull(value) || isUndefined(value) || value === false
}
