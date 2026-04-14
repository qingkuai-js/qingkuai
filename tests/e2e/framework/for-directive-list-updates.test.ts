import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let nextId = 2
            let items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]

            const addItem = () => {
                nextId++
                items.push({ id: nextId, label: "Item " + nextId })
            }

            const removeLastItem = () => {
                if (items.length) {
                    items.pop()
                }
            }

            const swapFirstTwoItems = () => {
                if (items.length > 1) {
                    items = [items[1], items[0], ...items.slice(2)]
                }
            }
        </lang-js>

        <section data-page="for-directive-list-updates">
            <h1 id="for-title">For directive</h1>

            <div>
                <button id="for-add-item" @click={addItem()}>Add item</button>
                <button id="for-remove-item" @click={removeLastItem()}>Remove last</button>
                <button id="for-swap-items" @click={swapFirstTwoItems()}>Swap first two</button>
            </div>

            <ul id="for-basic-list">
                <li #for={item, index of items} #key={item.id} class="for-basic-item">{index}:{item.label}</li>
            </ul>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports add remove and swap flows for list source updates", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#for-add-item").click()
        await expect(page.locator("#for-basic-list .for-basic-item")).toHaveText([
            "0:Alpha",
            "1:Beta",
            "2:Item 3"
        ])

        await page.locator("#for-swap-items").click()
        await expect(page.locator("#for-basic-list .for-basic-item")).toHaveText([
            "0:Beta",
            "1:Alpha",
            "2:Item 3"
        ])

        await page.locator("#for-remove-item").click()
        await expect(page.locator("#for-basic-list .for-basic-item")).toHaveText([
            "0:Beta",
            "1:Alpha"
        ])
    })
})
