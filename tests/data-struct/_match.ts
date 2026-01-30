import type { LinkedListNode } from "../../src/runtime/data-struct/linked-list"

import { expect } from "vitest"
import { getLastElem } from "../../src/util/shared/arrays"
import { LinkedList } from "../../src/runtime/data-struct/linked-list"

// 通过数组创建双向链表
// Create a bidirectional linked list from an array
export function createLinkedListFromArray<T>(arr: T[]): LinkedList<T> {
    const ret = new LinkedList<T>()
    for (const item of arr) {
        ret.insert(item)
    }
    return ret
}

// 获取双向链表中指定索引的节点
// Get the node at the specified index in the bidirectional linked list
export function getIndexedLinkedListNode<T>(list: LinkedList<T>, index: number) {
    for (let node = list.head; node; ) {
        if (index === 0) {
            return node
        }
        if (--index < 0) {
            return
        }
        node = node.next
    }
}

// 匹配验证双向列表节点列表
// Match and validate the bidirectional linked list node list
export function matchLinkedList<T>(list: LinkedList<T>, expected: T[]) {
    const nodes: LinkedListNode<T>[] = []
    expect(list.size).toBe(expected.length)

    for (let node = list.head; node; ) {
        nodes.push(node)
        node = node.next
    }
    if (nodes.length) {
        expect(nodes[0]).toBe(list.head)
        expect(getLastElem(nodes)).toBe(list.tail)
    }
    for (let i = 0; i < nodes.length; i++) {
        expect(nodes[i].data).toEqual(expected[i])
        expect(nodes[i].prev).toBe(nodes[i - 1] ?? null)
        expect(nodes[i].next).toBe(nodes[i + 1] ?? null)
    }
}
