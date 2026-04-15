import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let ifTarget = null
            let showIfTarget = true

            const moveIfToA = () => {
                ifTarget = "#target-dest-a"
            }

            const toggleIfTarget = () => {
                showIfTarget = !showIfTarget
            }
        </lang-js>

        <section data-page="target-directive-combinators">
            <h1 id="target-title">Target directive</h1>
            <div>
                <button id="target-if-to-a" @click={moveIfToA()}>If to A</button>
                <button id="target-if-toggle" @click={toggleIfTarget()}>Toggle if</button>
            </div>
            <div id="target-if-source">
                <p id="target-if-content" #if={showIfTarget} #target={ifTarget}>If payload</p>
            </div>
            <div id="target-dest-a"></div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports target directive combined with if", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await page.locator("#target-if-to-a").click()
        await expect(page.locator("#target-dest-a #target-if-content")).toHaveText("If payload")

        await page.locator("#target-if-toggle").click()
        await expect(page.locator("#target-dest-a #target-if-content")).toHaveCount(0)
        await page.locator("#target-if-toggle").click()
        await expect(page.locator("#target-dest-a #target-if-content")).toHaveText("If payload")
    })
})
