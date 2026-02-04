import type { AnyObject } from "#type-declarations/tools"
import type { ClassAttrValue } from "#type-declarations/runtime"

import { NotArrayOrSet } from "./messages/error"
import { objectKeys } from "../util/shared/aliases"
import { getElementValue, getNodeContext } from "./dom"
import { reactiveNotEqual } from "../util/runtime/sundry"
import { any, notEqual, optc } from "../util/shared/sundry"
import { isArray, isBoolean, isString } from "../util/shared/assert"

export function setClassName(elem: HTMLElement, value: ClassAttrValue) {
    const classList: string[] = []
    const attributes = getNodeContext(elem).a
    if (isString(value)) {
        classList.push(value)
    } else if (isArray(value)) {
        for (const item of value) {
            if (isString(item)) {
                classList.push(item)
            } else {
                classList.push(getClassNameWithObject(item))
            }
        }
    } else {
        classList.push(getClassNameWithObject(value))
    }

    const className = classList.join(" ")
    if (className != attributes.class) {
        attributes.class = elem.className = className
    }
}

export function setAttribute(elem: HTMLElement, name: string, value: any) {
    const attributes = getNodeContext(elem).a
    if (!reactiveNotEqual(attributes[name], value)) {
        return
    }
    attributes[name] = value

    if (name in elem) {
        try {
            any(elem)[name] = value
            return
        } catch {}
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
    const type = optc(target)
    const containerIsArray = type === "Array"
    if (!elem.multiple) {
        if (notEqual(target, getElementValue(elem))) {
            for (const option of elem.options) {
                option.selected = !notEqual(target, getElementValue(option))
            }
            getNodeContext(elem).a.value = target
        }
    } else {
        if (!containerIsArray && type !== "Set") {
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
    const classList: string[] = []
    for (const key of objectKeys(o)) {
        if (isString(key) && o[key]) {
            classList.push(key)
        }
    }
    return classList.join(" ")
}
