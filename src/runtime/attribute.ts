import type { AnyObject } from "#type-declarations/tools"
import type { ClassAttrValue } from "#type-declarations/runtime"

import { getElementValue } from "./dom"
import { ATTRIBUTE_PREFIX } from "./constants"
import { NotArrayOrSet } from "./messages/error"
import { objectKeys } from "../util/shared/aliases"
import { reactiveNotEqual } from "../util/runtime/sundry"
import { any, notEqual, optc } from "../util/shared/sundry"
import { isArray, isBoolean, isString } from "../util/shared/assert"

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

export function setXlinkAttribute(elem: HTMLElement, name: string, value: any) {
    elem.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:" + name, value)
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
    if (!elem.multiple) {
        if (notEqual(target, getElementValue(elem))) {
            for (const option of elem.options) {
                option.selected = !notEqual(target, getElementValue(option))
            }
            any(elem)[ATTRIBUTE_PREFIX + "value"] = target
        }
    } else {
        const containerIsArray = isArray(target)
        if (!containerIsArray && optc(target) !== "Set") {
            return NotArrayOrSet("value", "<select multiple>")
        }
        for (const option of elem.options) {
            setAttribute(
                option,
                "selected",
                target[containerIsArray ? "includes" : "has"](getElementValue(option))
            )
        }
    }
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
