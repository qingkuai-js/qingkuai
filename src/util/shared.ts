import type { AnyObject, FixedArray } from "./types"

import { undef } from "../runtime/constants"

// 事件监听器flag
export const EventListenerFlag = {
    once: 1 << 0,
    stop: 1 << 1,
    self: 1 << 2,
    capture: 1 << 3,
    passive: 1 << 4,
    prevent: 1 << 5,
    compose: 1 << 6
}

// 事件包装器flag
export const EventWrapperFlag = {
    enter: 1 << 0,
    tab: 1 << 1,
    del: 1 << 2,
    esc: 1 << 3,
    up: 1 << 4,
    down: 1 << 5,
    left: 1 << 6,
    right: 1 << 7,
    space: 1 << 8,

    meta: 1 << 9,
    alt: 1 << 10,
    ctrl: 1 << 11,
    shift: 1 << 12
}

// 访问Symbol.toStringTag属性
export function stringTag(v: any) {
    return v?.[Symbol.toStringTag]
}

// 获取length属性
export function len(v: any): number {
    return v?.length || 0
}

// 获取数组最后一个元素
export function lastElem<T>(arr: T[]) {
    return arr[len(arr) - 1]
}

// 判断两值是否不等
export function notEqual(v1: any, v2: any) {
    return v1 !== v1 ? v2 === v2 : v1 !== v2
}

// 判断两值是否相等
export function isEqual(v1: any, v2: any) {
    return v1 !== v1 ? v2 !== v2 : v1 === v2
}

// 判断两值转换为字符串后是否不等
export function strNotEqual(v1: any, v2: any) {
    return "" + v1 !== "" + v2
}

// 执行数组中的所有函数
export function runAll(fns: Function[], ...params: any[]) {
    fns.forEach(fn => fn(...params))
}

// 类型判断
export function isEmptyString(v: any): v is "" {
    return v === ""
}
export function isNull(v: any): v is null {
    return v === null
}
export function isArray(v: any): v is any[] {
    return Array.isArray(v)
}
export function isNaN(v: any): v is Number {
    return Number.isNaN(v)
}
export function isUndefined(v: any): v is undefined {
    return v === undef
}
export function isNumber(v: any): v is number {
    return typeof v === "number"
}
export function isString(v: any): v is string {
    return typeof v === "string"
}
export function isBoolean(v: any): v is boolean {
    return typeof v === "boolean"
}
export function isFunction(v: any): v is Function {
    return typeof v === "function"
}
export function isObject(v: any): v is AnyObject {
    return optc(v) === "Object"
}

// 将类数组值转换为数组
export function toArray<T>(iter: Iterable<T>) {
    return Array.from(iter)
}

// 设置数组的length属性，可以用来删除多余元素
export function setArrLength(arr: any[], len: number) {
    return (arr.length = len)
}

// 获取Set、Map的values数组
export function values<T>(target: Set<T> | Map<any, T>) {
    return toArray(target.values())
}

// 修改数组为另一个数组，与直接赋值不同的是此方法将会保留对原数组的引用
export function replaceEachItems<T>(oa: T[], na: T[]) {
    const naLen = len(na)
    for (let i = 0; i < naLen; i++) {
        oa[i] = na[i]
    }
    setArrLength(oa, naLen)
}

// 获取Map的entries数组
export function entries<K, V>(target: Map<K, V>) {
    return toArray(target.entries())
}

// Object.prototype.toString.call别名，返回类型字符串，去掉[object ]
export function optc(v: any) {
    return Object.prototype.toString.call(v).slice(8, -1)
}

// Object.keys别名，返回带有类型的键数组
export function typedKeys<T extends AnyObject>(obj: T): Array<keyof T> {
    return Object.keys(obj) as any
}

// 以init为初始值创建指定长度的数组
export function arrayFill<T, L extends number>(len: L, init: T): FixedArray<T, L> {
    return Array(len).fill(init) as any
}
