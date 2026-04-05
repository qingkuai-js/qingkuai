import { expect, test } from "vitest"
import { LinkedList } from "../../../src/runtime/data-struct/linked-list"
import { matchLinkedList, getIndexedLinkedListNode, createLinkedListFromArray } from "./_match"

test("LinkedList method: insert", () => {
    const list = new LinkedList<number>()
    list.insert(1)
    matchLinkedList(list, [1])

    list.insert(2)
    matchLinkedList(list, [1, 2])

    list.insert(3, list.head)
    matchLinkedList(list, [3, 1, 2])

    list.insert(4, list.tail)
    matchLinkedList(list, [3, 1, 4, 2])

    list.insert(5, list.head?.next)
    matchLinkedList(list, [3, 5, 1, 4, 2])
})

test("LinkedList method: remove", () => {
    const languages = ["js", "ts", "qk", "php", "go"]
    const list = createLinkedListFromArray(languages)
    matchLinkedList(list, languages)

    let node = getIndexedLinkedListNode(list, 2)
    expect(node?.data).toBe("qk")
    list.remove(node)
    matchLinkedList(list, ["js", "ts", "php", "go"])

    node = getIndexedLinkedListNode(list, 2)
    expect(node?.data).toBe("php")
    list.remove(node)
    matchLinkedList(list, ["js", "ts", "go"])

    list.remove(list.head)
    matchLinkedList(list, ["ts", "go"])

    list.remove(list.tail)
    matchLinkedList(list, ["ts"])

    list.remove(getIndexedLinkedListNode(list, 0))
    matchLinkedList(list, [])
})
