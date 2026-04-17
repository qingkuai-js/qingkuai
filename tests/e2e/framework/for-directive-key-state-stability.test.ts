import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]

            const swapItems = () => {
                items = [items[1], items[0]]
            }
        </lang-js>

        <section data-page="for-directive-key-state-stability">
            <button id="swap-items" @click={swapItems}>Swap items</button>

            <ul id="state-list">
                <li
                    class="state-item"
                    #for={item of items}
                    #key={item.id}
                >
                    <span class="state-label">{item.label}</span>
                    <input class="state-input" />
                </li>
            </ul>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("keeps local input state bound to keyed item identity after reorder", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const labels = page.locator("#state-list .state-label")
        const inputs = page.locator("#state-list .state-input")

        await expect(labels).toHaveText(["Alpha", "Beta"])
        await inputs.nth(0).fill("typed-alpha")
        await inputs.nth(1).fill("typed-beta")

        await page.locator("#swap-items").click()

        await expect(labels).toHaveText(["Beta", "Alpha"])
        await expect(inputs.nth(0)).toHaveValue("typed-beta")
        await expect(inputs.nth(1)).toHaveValue("typed-alpha")
    })
})
