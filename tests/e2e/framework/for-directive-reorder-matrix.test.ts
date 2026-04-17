import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let nextId = 3
            let items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" },
                { id: 3, label: "Gamma" }
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

            const insertHead = () => {
                nextId++
                items = [{ id: nextId, label: "Item " + nextId }, ...items]
            }

            const removeMiddle = () => {
                if (items.length > 2) {
                    items = [items[0], ...items.slice(2)]
                }
            }
        </lang-js>

        <section data-page="for-directive-reorder-matrix">
            <h1 id="for-title">For directive reorder matrix</h1>
            <button id="move-last-first" @click={moveLastToFirst}>Move last to first</button>
            <button id="reverse-items" @click={reverseItems}>Reverse</button>
            <button id="insert-head" @click={insertHead}>Insert head</button>
            <button id="remove-middle" @click={removeMiddle}>Remove middle</button>

            <ul id="reorder-list">
                <li
                    #for={item of items}
                    #key={item.id}
                    class="reorder-item"
                >
                    <span class="reorder-label">{item.label}</span>
                    <input class="reorder-input" />
                </li>
            </ul>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports complex keyed reorder operations", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const labels = page.locator("#reorder-list .reorder-label")

        await expect(labels).toHaveText(["Alpha", "Beta", "Gamma"])

        await page.locator("#move-last-first").click()
        await expect(labels).toHaveText(["Gamma", "Alpha", "Beta"])

        await page.locator("#reverse-items").click()
        await expect(labels).toHaveText(["Beta", "Alpha", "Gamma"])

        await page.locator("#insert-head").click()
        await expect(labels).toHaveText(["Item 4", "Beta", "Alpha", "Gamma"])

        await page.locator("#remove-middle").click()
        await expect(labels).toHaveText(["Item 4", "Alpha", "Gamma"])
    })

    test("keeps local input state aligned with keyed identity after reorders", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const inputs = page.locator("#reorder-list .reorder-input")

        await inputs.nth(0).fill("input-alpha")
        await inputs.nth(1).fill("input-beta")
        await inputs.nth(2).fill("input-gamma")

        await page.locator("#move-last-first").click()
        await expect(inputs.nth(0)).toHaveValue("input-gamma")
        await expect(inputs.nth(1)).toHaveValue("input-alpha")
        await expect(inputs.nth(2)).toHaveValue("input-beta")

        await page.locator("#reverse-items").click()
        await expect(inputs.nth(0)).toHaveValue("input-beta")
        await expect(inputs.nth(1)).toHaveValue("input-alpha")
        await expect(inputs.nth(2)).toHaveValue("input-gamma")

        await page.locator("#insert-head").click()
        await expect(inputs.nth(0)).toHaveValue("")
        await expect(inputs.nth(1)).toHaveValue("input-beta")
        await expect(inputs.nth(2)).toHaveValue("input-alpha")
        await expect(inputs.nth(3)).toHaveValue("input-gamma")
    })
})
