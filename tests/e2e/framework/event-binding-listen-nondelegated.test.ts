import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let ancestorCaptureCount = 0
            let inputOnceCount = 0

            const onAncestorCapture = () => {
                ancestorCaptureCount++
            }

            const onInputFocus = () => {
                inputOnceCount++
            }
        </lang-js>

        <section data-page="event-binding-listen-nondelegated">
            <div
                id="focus-wrap"
                @focus|capture={onAncestorCapture}
            >
                <input
                    id="focus-input"
                    @focus|once={onInputFocus}
                />
            </div>
            <button id="blur-btn">Blur</button>
            <p id="ancestor-count">{ancestorCaptureCount}</p>
            <p id="input-count">{inputOnceCount}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("non-delegated focus honors capture and once", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#focus-input").focus()
        await page.locator("#blur-btn").click()
        await page.locator("#focus-input").focus()

        await expect(page.locator("#ancestor-count")).toHaveText("2")
        await expect(page.locator("#input-count")).toHaveText("1")
    })
})
