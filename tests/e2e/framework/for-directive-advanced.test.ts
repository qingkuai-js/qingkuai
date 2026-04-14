import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let showEvenOnly = false
            const items = [
                { id: 1, label: "Alpha" },
                { id: 2, label: "Beta" }
            ]

            const toggleEvenOnly = () => {
                showEvenOnly = !showEvenOnly
            }
        </lang-js>

        <section data-page="for-directive-advanced">
            <h1 id="for-title">For directive</h1>

            <button
                id="for-toggle-even-only"
                @click={toggleEvenOnly()}
            >
                Toggle even only
            </button>
            <ul id="for-if-nested-list">
                <li
                    #for={item of items}
                    class="for-if-nested-item"
                >
                    <span
                        #if={!showEvenOnly || item.id % 2 === 0}
                        class="for-if-hit"
                    >
                        show:{item.label}
                    </span>
                    <span
                        #else
                        class="for-if-miss"
                    >
                        hide:{item.label}
                    </span>
                </li>
            </ul>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports nested if branches inside for items", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#for-if-nested-list .for-if-hit")).toHaveText([
            "show:Alpha",
            "show:Beta"
        ])

        await page.locator("#for-toggle-even-only").click()
        await expect(page.locator("#for-if-nested-list .for-if-hit")).toHaveText(["show:Beta"])
    })
})
