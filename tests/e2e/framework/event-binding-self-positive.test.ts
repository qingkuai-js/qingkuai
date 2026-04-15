import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let selfCount = 0

            const incSelf = () => {
                selfCount++
            }
        </lang-js>

        <section data-page="event-binding-self-positive">
            <div
                id="self-div"
                @click|self={incSelf}
            >
                <button id="child-btn">Child</button>
            </div>
            <p id="self-count">{selfCount}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("self fires when clicking the element itself", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#self-div").click()
        await expect(page.locator("#self-count")).toHaveText("1")

        await page.locator("#child-btn").click()
        await expect(page.locator("#self-count")).toHaveText("1")
    })
})
