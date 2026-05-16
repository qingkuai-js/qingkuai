import { test, expect } from "vitest"
import { MinHeap } from "../../../src/compiler/data-struct/min-heap"

test("Class: MinHeap basic operations", () => {
    const heap = new MinHeap([{ k: 3 }, { k: 1 }, { k: 2 }], "k")
    expect(heap.size).toBe(3)
    expect(heap.first?.k).toBe(1)
    expect(heap.fetch()?.k).toBe(1)
    expect(heap.fetch()?.k).toBe(2)
    expect(heap.fetch()?.k).toBe(3)
    expect(heap.fetch()).toBeUndefined()
})

test("Class: MinHeap supports multi key compare", () => {
    const heap = new MinHeap(
        [
            {
                p1: 1,
                p2: 3
            },
            {
                p1: 1,
                p2: 2
            },
            {
                p1: 0,
                p2: 9
            },
            {
                p1: 1,
                p2: 1
            }
        ],
        "p1",
        "p2"
    )
    expect(heap.fetch()).toEqual({
        p1: 0,
        p2: 9
    })
    expect(heap.fetch()).toEqual({
        p1: 1,
        p2: 1
    })
    expect(heap.fetch()).toEqual({
        p1: 1,
        p2: 2
    })
    expect(heap.fetch()).toEqual({
        p1: 1,
        p2: 3
    })
})

test("Class: MinHeap insert and compare", () => {
    const heap = new MinHeap([{ id: 2 }, { id: 2 }], "id")
    heap.insert({ id: 1 })
    heap.insert({ id: 3 })

    expect(heap.compare(0, 1)).toMatch(/lt|eq/)
    expect(heap.fetch()?.id).toBe(1)
    expect(heap.fetch()?.id).toBe(2)
    expect(heap.fetch()?.id).toBe(2)
    expect(heap.fetch()?.id).toBe(3)
})
