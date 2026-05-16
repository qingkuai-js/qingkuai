import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let nextId = 4
            let items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" },
                { id: 3, label: "Gamma" },
                { id: 4, label: "Delta" }
            ]

            const moveLastToFirst = () => {
                if (items.length > 1) {
                    const last = items[items.length - 1]
                    items = [last, ...items.slice(0, -1)]
                }
            }

            const reverseItems = () => {
                items = [...items].reverse()
            }

            const rotateLeft = () => {
                if (items.length > 1) {
                    items = [...items.slice(1), items[0]]
                }
            }

            const insertHead = () => {
                nextId++
                items = [{ id: nextId, label: "Item " + nextId }, ...items]
            }

            const removeSecond = () => {
                if (items.length > 1) {
                    items = [items[0], ...items.slice(2)]
                }
            }
        </lang-js>

        <section data-page="for-directive-order-stability-unkeyed">
            <button id="move-last-first" @click={moveLastToFirst}>Move last to first</button>
            <button id="reverse-items" @click={reverseItems}>Reverse</button>
            <button id="rotate-left" @click={rotateLeft}>Rotate left</button>
            <button id="insert-head" @click={insertHead}>Insert head</button>
            <button id="remove-second" @click={removeSecond}>Remove second</button>

            <ul id="order-list">
                <li
                    class="order-item"
                    #for={item of items}
                >
                    {item.label}
                </li>
            </ul>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("unkeyed for follows source order across reorder operations", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const labels = page.locator("#order-list .order-item")

        await expect(labels).toHaveText(["Alpha", "Beta", "Gamma", "Delta"])

        await page.locator("#move-last-first").click()
        await expect(labels).toHaveText(["Delta", "Alpha", "Beta", "Gamma"])

        await page.locator("#rotate-left").click()
        await expect(labels).toHaveText(["Alpha", "Beta", "Gamma", "Delta"])

        await page.locator("#reverse-items").click()
        await expect(labels).toHaveText(["Delta", "Gamma", "Beta", "Alpha"])
    })

    test("unkeyed for keeps displayed order aligned after mixed insert and remove", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const labels = page.locator("#order-list .order-item")

        await page.locator("#insert-head").click()
        await expect(labels).toHaveText(["Item 5", "Alpha", "Beta", "Gamma", "Delta"])

        await page.locator("#remove-second").click()
        await expect(labels).toHaveText(["Item 5", "Beta", "Gamma", "Delta"])

        await page.locator("#move-last-first").click()
        await expect(labels).toHaveText(["Delta", "Item 5", "Beta", "Gamma"])
    })
})
