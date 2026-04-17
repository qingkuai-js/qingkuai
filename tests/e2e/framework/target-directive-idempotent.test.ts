import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let targetSelector = null

            const moveToA = () => {
                targetSelector = "#target-dest-a"
            }

            const resetInline = () => {
                targetSelector = null
            }
        </lang-js>

        <section data-page="target-directive-idempotent">
            <h1 id="target-title">Target directive</h1>
            <button id="target-to-a" @click={moveToA}>Teleport to A</button>
            <button id="target-reset" @click={resetInline}>Reset inline</button>

            <div id="target-source-container">
                <div #target={targetSelector}>
                    <input id="target-input" />
                </div>
            </div>

            <div id="target-dest-a"></div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("does not duplicate nodes when assigning the same target repeatedly", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#target-to-a").click()
        await expect(page.locator("#target-dest-a #target-input")).toHaveCount(1)

        await page.locator("#target-dest-a #target-input").fill("typed")
        await page.locator("#target-to-a").click()

        await expect(page.locator("#target-dest-a #target-input")).toHaveCount(1)
        await expect(page.locator("#target-source-container #target-input")).toHaveCount(0)
        await expect(page.locator("#target-dest-a #target-input")).toHaveValue("typed")
    })

    test("keeps inline target idempotent when reset is repeated", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await page.locator("#target-to-a").click()
        await expect(page.locator("#target-dest-a #target-input")).toHaveCount(1)

        await page.locator("#target-reset").click()
        await expect(page.locator("#target-source-container #target-input")).toHaveCount(1)

        await page.locator("#target-reset").click()
        await expect(page.locator("#target-source-container #target-input")).toHaveCount(1)
        await expect(page.locator("#target-dest-a #target-input")).toHaveCount(0)
    })
})
