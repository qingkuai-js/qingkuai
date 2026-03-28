// 注意：双向链表在当前版本中未被用到，在早期的版本中，响应式依赖的更新函数和销毁方法
// 通过双向链表记录，但是这种方式会导致浏览器的devtool分析内存占用十分缓慢。
// 当前版本使用Set替代了早期的双向链表，如若之后持续用不到此结构请考虑移除此文件。
//
// Note: this data struct is not used for current version.
// In an earlier version，update functions of dependency and destruction structs are
// recorded by LinkedList, but it causes browser devtools to analyze memory chains very slowly.
// In current version, it was replaced by Set, if this structure is sure to be unused in future versions,
// consider deleting this file please.

import { NIL, UNDEF } from "../constants"

export type LinkedListNode<T> = {
    data: T
    prev: PartialLinkedListNode<T>
    next: PartialLinkedListNode<T>
}
export type PartialLinkedListNode<T> = LinkedListNode<T> | null

// 双向链表
// Bidirectional Linked List
export class LinkedList<T> {
    private _size = 0
    private _head: PartialLinkedListNode<T> = NIL
    private _tail: PartialLinkedListNode<T> = NIL

    get size() {
        return this._size
    }

    get head() {
        return this._head
    }

    get tail() {
        return this._tail
    }

    toArray() {
        const result: T[] = []
        for (const node of this) {
            result.push(node.data)
        }
        return result
    }

    insert(data: T, before: PartialLinkedListNode<T> = NIL) {
        const newNode: LinkedListNode<T> = {
            data,
            next: before ?? NIL,
            prev: before ? before.prev : this.tail
        }
        if (before) {
            before.prev = newNode
        } else {
            this._tail = newNode
        }
        if (newNode.prev) {
            newNode.prev.next = newNode
        }
        if (!this.head || before === this.head) {
            this._head = newNode
        }
        this._size++
    }

    remove(node: PartialLinkedListNode<T> | undefined) {
        if (!node) {
            return
        }
        if (node.prev) {
            node.prev.next = node.next
        } else {
            this._head = node.next
        }
        if (node.next) {
            node.next.prev = node.prev
        } else {
            this._tail = node.prev
        }
        node.prev = node.next = NIL
        this._size--
    }

    [Symbol.iterator]() {
        let current: PartialLinkedListNode<T> = this.head
        return {
            next(): IteratorResult<LinkedListNode<T>> {
                if (current) {
                    const value = current
                    current = current.next
                    return { value, done: false }
                }
                return { done: true, value: UNDEF }
            }
        }
    }

    // 其他方法暂未用到
    // other mthods are not used for the moment...
}
