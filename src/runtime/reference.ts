import type { Getter, Setter } from "#type-declarations/tools"

import { getElementValue } from "./dom"
import { setInputGroup } from "./attribute"
import { ATTRIBUTE_PREFIX } from "./constants"
import { isArray } from "../util/shared/assert"
import { pushDestructionCleaner } from "./destroy"
import { spliceByElem } from "../util/shared/arrays"
import { any, notEqual } from "../util/shared/sundry"
import { listen, renderEffect, setAttribute, setSelectValue } from "./internal"

export function bindDomReceiver(elem: any, setter: Setter) {
    pushDestructionCleaner(() => {
        setter(null)
    })
    setter(elem)
}

export function bindInputValue(elem: HTMLInputElement, getTarget: Getter, setValue: Setter) {
    listen(elem, "input", () => setValue(elem.value))
    renderEffect(() => setAttribute(elem, "value", getTarget()))
}

export function bindInputNumber(elem: HTMLInputElement, getTarget: Getter, setValue: Setter) {
    listen(elem, "input", () => setValue(+elem.value))
    renderEffect(() => setAttribute(elem, "value", getTarget()))
}

export function bindInputChecked(elem: HTMLInputElement, getTarget: Getter, setValue: Setter) {
    listen(elem, "change", () => setValue(elem.checked))
    renderEffect(() => setAttribute(elem, "checked", getTarget()))
}

export function bindInputGroup(elem: HTMLInputElement, getTarget: Getter) {
    listen(elem, "change", () => {
        const target = getTarget()
        const { checked } = elem
        const value = getElementValue(elem)
        if (!isArray(target)) {
            if (checked) {
                target.add(value)
            } else {
                target.delete(value)
            }
        } else if (checked) {
            target.push(value)
        } else {
            spliceByElem(target, value)
        }
    })
    renderEffect(() => setInputGroup(elem, getTarget()))
}

export function bindSelectValue(elem: HTMLSelectElement, getTarget: Getter) {
    listen(elem, "change", () => {
        const target = getTarget()
        if (elem.multiple) {
            for (const option of elem.options) {
                const value = getElementValue(option)
                if (!notEqual(target, value)) {
                    target((any(option)[ATTRIBUTE_PREFIX + "value"] = value))
                }
            }
        } else {
            for (const option of elem.options) {
                const { selected } = option
                const value = getElementValue(option)
                if (!isArray(target)) {
                    if (selected) {
                        target.add(value)
                    } else {
                        target.delete(value)
                    }
                } else if (selected) {
                    target.push(value)
                } else {
                    spliceByElem(target, value)
                }
            }
        }
    })
    renderEffect(() => setSelectValue(elem, getTarget()))
}
