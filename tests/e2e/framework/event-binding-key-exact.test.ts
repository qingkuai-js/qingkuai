import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let exactEnterCount = 0

            const incExactEnter = () => {
                exactEnterCount++
            }
        </lang-js>

        <section data-page="event-binding-key-exact">
            <input
                id="exact-enter-input"
                placeholder="Press exact Enter"
                @keydown|exact|enter={incExactEnter}
            />
            <p id="exact-enter-count">{exactEnterCount}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("exact blocks key combo and allows plain enter", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#exact-enter-input").press("Shift+Enter")
        await expect(page.locator("#exact-enter-count")).toHaveText("0")

        await page.locator("#exact-enter-input").press("Control+Enter")
        await expect(page.locator("#exact-enter-count")).toHaveText("0")

        await page.locator("#exact-enter-input").press("Enter")
        await expect(page.locator("#exact-enter-count")).toHaveText("1")
    })
})
