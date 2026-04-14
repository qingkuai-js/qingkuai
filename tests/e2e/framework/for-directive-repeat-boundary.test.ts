import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let repeatItems = [1, 2, 3]

            const setRepeatZero = () => {
                repeatItems = []
            }

            const setRepeatFour = () => {
                repeatItems = [1, 2, 3, 4]
            }
        </lang-js>

        <section data-page="for-directive-repeat-boundary">
            <h1 id="for-title">For directive</h1>
            <div>
                <button id="for-repeat-zero" @click={setRepeatZero()}>Repeat 0</button>
                <button id="for-repeat-four" @click={setRepeatFour()}>Repeat 4</button>
            </div>
            <div id="for-repeat-host">
                <span #for={n of repeatItems} class="for-repeat-item">{n}</span>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports numeric source boundary updates", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#for-repeat-zero").click()
        await expect(page.locator("#for-repeat-host .for-repeat-item")).toHaveCount(0)

        await page.locator("#for-repeat-four").click()
        await expect(page.locator("#for-repeat-host .for-repeat-item")).toHaveCount(4)
    })
})
