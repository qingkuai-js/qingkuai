import type { Getter, Setter } from "#type-declarations/tools"

import { getElementValue } from "./dom"
import { any } from "../util/shared/sundry"
import { setInputGroup } from "./attribute"
import { ATTRIBUTE_PREFIX } from "./constants"
import { isArray } from "../util/shared/assert"
import { pushDestructionCleaner } from "./destroy"
import { spliceByElem } from "../util/shared/arrays"
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

export function bindSelectValue(elem: HTMLSelectElement, getTarget: Getter, setValue: Setter) {
    listen(elem, "change", () => {
        const target = getTarget()
        const options = elem.options ?? []
        if (elem.multiple) {
            const targetIsArray = isArray(target)
            if (targetIsArray) {
                target.length = 0
            } else {
                target.clear()
            }
            for (const option of options) {
                const selected = option.selected
                const value = getElementValue(option)
                if (selected) {
                    if (targetIsArray) {
                        target.push(value)
                    } else {
                        target.add(value)
                    }
                }
            }
        } else {
            for (const option of options) {
                if (option.selected) {
                    setValue((any(option)[ATTRIBUTE_PREFIX + "value"] = getElementValue(option)))
                }
            }
        }
    })
    renderEffect(() => setSelectValue(elem, getTarget()))
}
