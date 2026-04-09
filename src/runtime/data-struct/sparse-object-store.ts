import { UNDEF } from "../constants"
import { newCleanObj } from "../../util/shared/sundry"
import { isUndefined } from "../../util/shared/assert"

/** {@link import("../directives/list").keyedListBlock} */

// 为了减少运行时体积，此类的实现已被内联进 keyedListBlock 方法，若此结构确定在之后的版本中不会被复用，可考虑删除。
//
// To reduce runtime bundle size, this class implementation has been inlined into keyedListBlock.
// If this structure is confirmed to be unused in future versions, consider deleting it.

export class SparseObjectStore<T> {
    private holes = 0
    private store: Record<string, T | undefined> = newCleanObj()

    constructor(private readonly minHoles = 256) {}

    get(key: string) {
        return this.store[key]
    }

    set(key: string, value: T) {
        this.store[key] = value
    }

    remove(key: string) {
        if (isUndefined(this.store[key])) {
            return false
        }
        this.store[key] = UNDEF
        this.holes++
        return true
    }

    clear() {
        this.store = newCleanObj()
        this.holes = 0
    }

    compact(keys: string[]) {
        if (this.holes <= this.minHoles || this.holes <= keys.length) {
            return false
        }

        const compacted: Record<string, T> = newCleanObj()
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            const value = this.store[key]
            if (!isUndefined(value)) {
                compacted[key] = value
            }
        }
        this.store = compacted
        this.holes = 0
        return true
    }
}
