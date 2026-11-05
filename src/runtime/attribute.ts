import type { AnyObject } from "#type-declarations/tools";
import type { ClassAttrValue } from "#type-declarations/runtime";

import {
    UNDEF,
    SVG_FLAG,
    CLASS_CACHE_KEY,
    VALUE_CACHE_KEY,
    ATTRIBUTE_PREFIX,
    SVG_NAMESPACE_URI,
    XLINK_NAMESPACE_URI,
} from "./constants";
import { getElementValue } from "./dom";
import { NotArrayOrSet } from "./messages/error";
import { objectKeys } from "../util/shared/aliases";
import { any, notEqual, optc } from "../util/shared/sundry";
import { nextTick, reactiveNotEqual } from "../util/runtime/sundry";
import { isArray, isBoolean, isNull, isString, isUndefined } from "../util/shared/assert";

// 属性缓存键会被频繁用作 DOM 元素上的扩展属性名，缓存字符串拼接结果
// 可以避免每次访问都为属性名重新分配字符串
//
// The cache keys are used as expando property names on DOM elements on hot
// paths; memoizing the concatenation avoids re-allocating the name every time.
const attributeCacheKeys = /*#__PURE__*/ new Map<string, string>();

// 组件的元素命名空间只有运行时才知道，SVG 元素的 className 是只读的，因此 SVG 元素按属性写入
//
// The element namespace of a component is only known at runtime, and the className of an
// SVG element is read-only, so SVG elements are written as an attribute.
export function setHtmlClassName(elem: Element, value: ClassAttrValue) {
    const className = getClassName(value);
    if (className === any(elem)[CLASS_CACHE_KEY]) {
        return;
    }
    any(elem)[CLASS_CACHE_KEY] = className;

    if (!className) {
        elem.removeAttribute("class");
    } else if (isSvgElement(elem)) {
        elem.setAttribute("class", className);
    } else {
        elem.className = className;
    }
}

// 按属性写入 class：SVG 元素的 className 是只读的，插槽内容的元素命名空间只有运行时
// 才知道，这两种情况都用 setAttribute，对 SVG 与 HTML 元素都成立
//
// Writes the class as an attribute. The className of an SVG element is read-only, and the
// namespace of slot content is only known at runtime; setAttribute is correct for both
// SVG and HTML elements.
export function setClassAttribute(elem: Element, value: ClassAttrValue) {
    setAttribute(elem, "class", getClassName(value));
}

// HTML 元素的同名属性是可写的，直接赋值比 setAttribute 快；SVG 的只读属性赋值会抛错，
// 所以判定为 SVG 的元素不再尝试属性赋值
//
// The same-named property of an HTML element is writable and assigning it is faster than
// setAttribute; assigning an SVG property throws, so elements known to be SVG skip the
// property attempt entirely.
export function setHtmlAttribute(elem: Element, name: string, value: any) {
    const cacheKey = getAttributeCacheKey(name);
    if (!reactiveNotEqual(any(elem)[cacheKey], value)) {
        return;
    }
    if (!isNull(value) && !isUndefined(value) && !isSvgElement(elem) && name in elem) {
        try {
            any(elem)[name] = value;
            any(elem)[cacheKey] = value;
            return;
        } catch {
            // do nothing
        }
    }
    setAttribute(elem, name, value);
}

export function setAttribute(elem: Element, name: string, value: any) {
    const cacheKey = getAttributeCacheKey(name);
    if (!reactiveNotEqual(any(elem)[cacheKey], value)) {
        return;
    }
    any(elem)[cacheKey] = value;

    if (isNull(value) || isUndefined(value)) {
        elem.removeAttribute(name);
        return;
    }

    if (isBoolean(value)) {
        if (value) {
            value = "";
        } else {
            elem.removeAttribute(name);
            return;
        }
    }
    elem.setAttribute(name, value);
}

export function setXlinkAttribute(elem: Element, name: string, value: any) {
    const localName = name;
    const qualifiedName = "xlink:" + localName;
    const key = getAttributeCacheKey(qualifiedName);
    if (!reactiveNotEqual(any(elem)[key], value)) {
        return;
    }
    any(elem)[key] = value;

    if (isNull(value) || isUndefined(value) || value === false) {
        elem.removeAttributeNS(XLINK_NAMESPACE_URI, localName);
        return;
    }

    if (isBoolean(value)) {
        value = "";
    }
    elem.setAttributeNS(XLINK_NAMESPACE_URI, qualifiedName, value);
}

export function setInputGroup(elem: HTMLInputElement, target: any) {
    const type = optc(target);
    const containerIsArray = type === "Array";
    if (!containerIsArray && type !== "Set") {
        return NotArrayOrSet("group", `<input>(radio/checkbox)`);
    }
    setHtmlAttribute(
        elem,
        "checked",
        target[containerIsArray ? "includes" : "has"](getElementValue(elem)),
    );
}

export function setSelectValue(elem: HTMLSelectElement, target: any) {
    nextTick(() => {
        const options = elem.options ?? [];
        if (!elem.multiple) {
            if (notEqual(target, getElementValue(elem))) {
                for (const option of options) {
                    option.selected = !notEqual(target, getElementValue(option));
                }
                any(elem)[VALUE_CACHE_KEY] = target;
            }
        } else {
            const containerIsArray = isArray(target);
            if (!containerIsArray && optc(target) !== "Set") {
                return NotArrayOrSet("value", "<select multiple>");
            }
            for (const option of options) {
                setHtmlAttribute(
                    option,
                    "selected",
                    target[containerIsArray ? "includes" : "has"](getElementValue(option)),
                );
            }
        }
    });
}

function getAttributeCacheKey(name: string) {
    let key = attributeCacheKeys.get(name);
    if (key === UNDEF) {
        key = ATTRIBUTE_PREFIX + name;
        attributeCacheKeys.set(name, key);
    }
    return key;
}

function getClassNameWithObject(o: AnyObject) {
    let className = "";
    for (const key of objectKeys(o)) {
        if (isString(key) && o[key]) {
            className += (className ? " " : "") + key;
        }
    }
    return className;
}

function getClassNameString(value: any): string {
    if (isString(value)) {
        return value;
    }
    if (isArray(value)) {
        let className = "";
        for (let i = 0; i < value.length; i++) {
            className += getClassNameString(value[i]);
            if (i < value.length - 1) {
                className += " ";
            }
        }
        return className;
    }
    return getClassNameWithObject(value);
}

function getClassName(value: ClassAttrValue) {
    return isString(value) ? value : getClassNameString(value);
}

function isSvgElement(elem: Element) {
    return (any(elem)[SVG_FLAG] ??= elem.namespaceURI === SVG_NAMESPACE_URI);
}
