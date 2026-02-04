import type { Setter } from "#type-declarations/tools"

import { listen } from "./internal"
import { isArray } from "../util/shared/assert"
import { notEqual } from "../util/shared/sundry"
import { spliceByElem } from "../util/shared/arrays"
import { getElementValue, getNodeContext } from "./dom"

export function bindInputValue(elem: HTMLInputElement, setter: Setter) {
    listen(elem, "input", () => setter(elem.value))
}

export function bindInputNumber(elem: HTMLInputElement, setter: Setter) {
    listen(elem, "input", () => setter(+elem.value))
}

export function bindInputChecked(elem: HTMLInputElement, setter: Setter) {
    listen(elem, "change", () => setter(elem.checked))
}

export function bindInputGroup(elem: HTMLInputElement, target: any) {
    listen(elem, "change", () => {
        const { checked } = elem
        const value = getElementValue(elem)
        if (!isArray(target)) {
            checked ? target.add(value) : target.delte(value)
        } else {
            checked ? target.push(value) : spliceByElem(target, value)
        }
    })
}

export function bindSelectValue(elem: HTMLSelectElement, target: any) {
    listen(elem, "change", () => {
        if (elem.multiple) {
            for (const option of elem.options) {
                const value = getElementValue(option)
                if (!notEqual(target, value)) {
                    target((getNodeContext(elem).a.value = value))
                }
            }
        } else {
            for (const option of elem.options) {
                const { selected } = option
                const value = getElementValue(option)
                if (!isArray(target)) {
                    selected ? target.add(value) : target.delete(value)
                } else {
                    selected ? target.push(value) : spliceByElem(target, value)
                }
            }
        }
    })
}
