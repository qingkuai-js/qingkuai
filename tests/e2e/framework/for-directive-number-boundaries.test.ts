import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let count = 2

            const setZero = () => {
                count = 0
            }

            const setNegative = () => {
                count = -1
            }

            const setDecimal = () => {
                count = 2.1
            }
        </lang-js>

        <section data-page="for-directive-number-boundaries">
            <button id="set-zero" @click={setZero}>Set zero</button>
            <button id="set-negative" @click={setNegative}>Set negative</button>
            <button id="set-decimal" @click={setDecimal}>Set decimal</button>

            <div id="number-boundary-host">
                <span #for={count} class="number-boundary-item">N</span>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports numeric for source boundary updates", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#number-boundary-host .number-boundary-item")).toHaveCount(2)

        await page.locator("#set-zero").click()
        await expect(page.locator("#number-boundary-host .number-boundary-item")).toHaveCount(0)

        await page.locator("#set-negative").click()
        await expect(page.locator("#number-boundary-host .number-boundary-item")).toHaveCount(0)

        await page.locator("#set-decimal").click()
        await expect(page.locator("#number-boundary-host .number-boundary-item")).toHaveCount(3)
    })
})
