import type { Getter, Setter } from "#type-declarations/tools"

import { setInputGroup } from "./attribute"
import { isArray } from "../util/shared/assert"
import { notEqual } from "../util/shared/sundry"
import { pushDestructionCleaner } from "./destroy"
import { spliceByElem } from "../util/shared/arrays"
import { getElementValue, getNodeContext } from "./dom"
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
    renderEffect(() => setAttribute(elem, "value", getTarget()))
}

export function bindInputGroup(elem: HTMLInputElement, getTarget: Getter) {
    listen(elem, "change", () => {
        const target = getTarget()
        const { checked } = elem
        const value = getElementValue(elem)
        if (!isArray(target)) {
            checked ? target.add(value) : target.delte(value)
        } else {
            checked ? target.push(value) : spliceByElem(target, value)
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
    renderEffect(() => setSelectValue(elem, getTarget()))
}
