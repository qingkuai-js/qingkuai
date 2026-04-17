import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const formState = {
                text: "hello",
                count: 2
            }

            const applyPreset = () => {
                formState.text = "preset"
                formState.count = 7
            }
        </lang-js>

        <section data-page="form-handling-input-bindings">
            <label>
                Text
                <input id="text-input" &value={formState.text} />
            </label>

            <label>
                Number
                <input id="number-input" type="number" &number={formState.count} />
            </label>

            <label>
                Free Number
                <input id="number-free-input" &number={formState.count} />
            </label>

            <button id="apply-preset" @click={applyPreset}>Apply preset</button>

            <p id="state-text">Text: {formState.text}</p>
            <p id="state-count">Count: {Number.isNaN(formState.count) ? "NaN" : formState.count}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("syncs text input to member expression target", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#text-input").fill("typed text")

        await expect(page.locator("#state-text")).toHaveText("Text: typed text")
    })

    test("applies model updates back to text and number controls", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#apply-preset").click()

        await expect(page.locator("#text-input")).toHaveValue("preset")
        await expect(page.locator("#number-input")).toHaveValue("7")
    })

    test("casts invalid numeric text to NaN via &number", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#number-free-input").fill("not-a-number")

        await expect(page.locator("#state-count")).toHaveText("Count: NaN")
    })
})
