export const arrayFrom: typeof Array.from = (...args: [any]) => {
    return Array.from(...args)
}

export function emptyArr(arr: any[]) {
    arr.length = 0
}

export function swapDelete(arr: any[], index: number) {
    if (index < 0) {
        return
    }

    const lastIndex = arr.length - 1
    if (lastIndex < 0) {
        return
    } else if (lastIndex > 0) {
        const temp = arr[lastIndex]
        arr[lastIndex] = arr[index]
        arr[index] = temp
    }
    arr.pop()
}

export function getLastElem<T>(arr: ArrayLike<T>): T | undefined {
    return arr[arr.length - 1]
}

// 修改数组为另一个数组，与直接赋值不同的是此方法将会保留对原数组的引用
// Replace the contents of an array with another array; unlike direct
// assignment, this method preserves the reference to the original array
export function replaceEachItems<T>(target: T[], from: T[]) {
    emptyArr(target)
    target.push(...from)
}

// 从数组中移除指定元素，sequenceSensitive 为 false 时使用 swap-delete 删除策略以降低时间复杂度
// Remove a specified element from the array. When `sequenceSensitive` is `false`, use the swap-delete strategy to reduce time complexity.
export function spliceByElem<T>(arr: T[], item: T, sequenceSensitive = true) {
    const index = arr.indexOf(item)
    if (index === -1) {
        return
    }
    if (sequenceSensitive) {
        arr.splice(index, 1)
    } else {
        swapDelete(arr, index)
    }
}
