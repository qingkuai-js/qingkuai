import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let count = 1
        </lang-js>

        <section data-page="form-handling-number-inferred-reactivity">
            <input id="number-input" &number={count} />
            <p id="state-count">Count: {Number.isNaN(count) ? "NaN" : count}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("infers reactivity for &number target without explicit assignment", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#state-count")).toHaveText("Count: 1")

        await page.locator("#number-input").fill("12.5")
        await expect(page.locator("#state-count")).toHaveText("Count: 12.5")

        await page.locator("#number-input").fill("not-a-number")
        await expect(page.locator("#state-count")).toHaveText("Count: NaN")
    })
})
