// 注意：双向链表在当前版本中未被用到，在早期的版本中，响应式依赖的更新函数和销毁方法
// 通过双向链表记录，但是这种方式会导致浏览器的devtool分析内存占用十分缓慢。
// 当前版本使用Set替代了早期的双向链表，如若之后持续用不到此结构请考虑移除此文件。

// Note: this data struct is not used for current version
// In an earlier version，update functions of dependency and destruction structs are
// recorded by LinkedList, but it causes browser devtools to analyze memory chains very slowly.
// In current version, it was replaced by Set, if this structure is sure to be unused in future versions,
// consider deleting this file please.

// 双向链表
// Bidirectional Linked List
export class LinkedList<T> {
    size = 0
    id = Symbol("id")
    head: PartialLinkedListNode<T> = null
    tail: PartialLinkedListNode<T> = null

    add(data: T) {
        return this.append(data, this.tail)
    }

    get(index: number) {
        let i = 0
        let cur = this.head
        while (i++ < index) {
            if (!cur) {
                throw TypeError("Node is not exist.")
            } else {
                cur = cur.next
            }
        }
        return cur
    }

    append(data: T, reference: PartialLinkedListNode<T>) {
        const newNode = {
            data,
            id: this.id,
            pre: reference,
            next: null
        }

        if (reference) {
            this.check(reference, "Reference node")
            if (reference !== this.tail) {
                reference.next = newNode
            } else {
                this.tail = reference.next = newNode
            }
        } else if (this.tail) {
            this.tail.next = newNode
        } else {
            this.head = this.tail = newNode
        }

        this.size++

        return newNode
    }

    each(callback: (item: T, index: number) => void) {
        eachFrom(this.head, callback)
    }

    remove(item: LinkedListNode<T>) {
        this.check(item, "Node")
        if (item.pre) {
            item.pre.next = item.next
        } else {
            this.head = item.next
        }
        if (item.next) {
            item.next.pre = item.pre
        } else {
            this.tail = item.pre
        }
        this.size--
    }

    check(item: LinkedListNode<T>, prefix: string) {
        if (item.id !== this.id) {
            throw TypeError(`${prefix} does not belong to this LinkedList.`)
        }
    }

    // 其他方法暂未用到
    // other mthods are not used for the moment...
}

// 从指定节点向后遍历
// traverse from a specific node
export function eachFrom<T>(
    start: PartialLinkedListNode<T>,
    callback: (item: T, index: number) => void
) {
    for (let index = 0; start; ) {
        callback(start.data, index++)
        start = start.next
    }
}

// 将链表转换为数组，这个方法是在QingKuai开发过程用方便查看执行效果使用的，未导出
// transform linked list to array, this method is used for QingKuai developement, it's not exported
export function linkedListToArray<T>(list: LinkedList<T>) {
    const ret: T[] = []
    list.each(node => {
        ret.push(node)
    })
    return ret
}

export type LinkedListNode<T> = {
    data: T
    id: Symbol
    pre: PartialLinkedListNode<T>
    next: PartialLinkedListNode<T>
}
export type PartialLinkedListNode<T> = LinkedListNode<T> | null
