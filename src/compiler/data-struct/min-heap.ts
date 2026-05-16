// 注意：小根堆在当前版本中未被用到，在早期的版本中，嵌入脚本转换器依赖小根堆来生成代码，
// 当前版本使用 CodeEditor 替代了早期的转换逻辑，如若之后持续用不到此结构请考虑移除此文件。
//
// Note: The min-heap is not used in the current version. In earlier versions, the embeddedscript transformer relied
// on the min-heap to generate code, and the current version uses `CodeEditor` to replace the earlier transformation logic.
// If this structure continues to be unused, consider removing this file.
export class MinHeap<T> {
    tree: T[] = []
    keys: (keyof T)[]

    constructor(init: T[], ...sortKeys: (keyof T)[]) {
        this.keys = sortKeys
        init.forEach((item, index) => {
            this.tree.push(item)
            this.up(index)
        })
    }

    get first(): T | undefined {
        return this.tree[0]
    }

    get size() {
        return this.tree.length
    }

    fetch() {
        const { tree } = this
        const first = this.first
        const last = tree.pop()
        if (last && last !== first) {
            tree[0] = last
            this.down(0)
        }
        return first
    }

    insert(value: T) {
        const { tree } = this
        tree.push(value)
        this.up(tree.length - 1)
    }

    up(index: number) {
        const { tree, compare } = this
        while (index !== 0) {
            const middle = ((index - 1) / 2) | 0
            if (compare(index, middle) === "lt") {
                ;[tree[index], tree[middle]] = [tree[middle], tree[index]]
                index = middle
            } else {
                break
            }
        }
    }

    down(index: number) {
        const { tree, compare, size } = this
        const lastHasLeafIndex = ((size - 2) / 2) | 0

        // index 对应的节点无子节点时无需调整，直接结束
        // No adjustment is needed when the node corresponding to `index` has no child nodes; exit directly.
        if (size === 1 || index > lastHasLeafIndex) {
            return
        }

        while (index <= lastHasLeafIndex) {
            let minIndex: number
            const leftIndex = index * 2 + 1
            const rightIndex = leftIndex + 1
            if (rightIndex > size - 1) {
                minIndex = leftIndex
            } else {
                if (compare(leftIndex, rightIndex) === "lt") {
                    minIndex = leftIndex
                } else {
                    minIndex = rightIndex
                }
            }

            // index 对应的节点小于等于较小的子节点时调整完成
            // Adjustment is complete when the node corresponding to `index` is less than or equal to the smaller child node.
            if (compare(index, minIndex) !== "gt") {
                break
            }

            ;[tree[index], tree[minIndex]] = [tree[minIndex], tree[index]]
            index = minIndex
        }
    }

    compare = (a: number, b: number) => {
        const { tree, keys } = this
        for (const key of keys) {
            const v1 = tree[a][key]
            const v2 = tree[b][key]
            if (v1 < v2) {
                return "lt"
            } else if (v1 > v2) {
                return "gt"
            }
        }
        return "eq"
    }
}
