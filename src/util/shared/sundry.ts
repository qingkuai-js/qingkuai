import type { AnyObject, FixedArray } from "../types"

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

// 清空数组
export function emptyArr(...arrs: any[][]) {
    arrs.forEach(arr => setArrLength(arr, 0))
}

// 将类数组值转换为数组
export function toArray<T>(iter: Iterable<T>) {
    return Array.from(iter)
}

// 获取Map的entries数组
export function entries<K, V>(target: Map<K, V>) {
    return toArray(target.entries())
}

export function escapeRegExpSource(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// 通过指定元素删除数组中对应的元素（只会删除第一个匹配项）
export function spliceByElem<T>(arr: T[], elem: T) {
    const index = arr.findIndex(item => item === elem)
    if (index !== -1) {
        arr.splice(index, 1)
    }
}

// 执行数组中的所有函数
export function runAll(fns: Function[], ...params: any[]) {
    fns.forEach(fn => fn(...params))
}

// 设置数组的length属性，可以用来删除多余元素
export function setArrLength(arr: any[], len: number) {
    return (arr.length = len)
}

// 修改数组为另一个数组，与直接赋值不同的是此方法将会保留对原数组的引用
export function replaceEachItems<T>(oa: T[], na: T[]) {
    const naLen = len(na)
    for (let i = 0; i < naLen; i++) {
        oa[i] = na[i]
    }
    setArrLength(oa, naLen)
}

// Object.prototype.toString.call别名，返回类型字符串，去掉[object ]
export function optc(v: any) {
    return Object.prototype.toString.call(v).slice(8, -1)
}

// 获取Set、Map的values数组
export function values<T>(target: Set<T> | Map<any, T>) {
    return toArray(target.values())
}

// Object.keys别名，返回带有类型的键数组
export function typedKeys<T extends AnyObject>(obj: T): Array<keyof T> {
    return Object.keys(obj) as any
}

// 以init为初始值创建指定长度的数组
export function arrayFill<T, L extends number>(len: L, init: T): FixedArray<T, L> {
    return Array(len).fill(init) as any
}
