import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let spreadTarget = null

            const moveSpreadToA = () => {
                spreadTarget = "#target-dest-a"
            }

            const resetSpreadInline = () => {
                spreadTarget = null
            }
        </lang-js>

        <section data-page="target-directive-structures">
            <h1 id="target-title">Target directive</h1>
            <div>
                <button id="target-spread-to-a" @click={moveSpreadToA()}>Spread to A</button>
                <button id="target-spread-reset" @click={resetSpreadInline()}>Spread reset</button>
            </div>
            <div id="target-spread-source">
                <qk:spread #target={spreadTarget}>
                    <span class="target-spread-item">Spread One</span>
                    <span class="target-spread-item">Spread Two</span>
                </qk:spread>
            </div>
            <div id="target-dest-a"></div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports target directive on qk spread", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#target-spread-source .target-spread-item")).toHaveText([
            "Spread One",
            "Spread Two"
        ])

        await page.locator("#target-spread-to-a").click()
        await expect(page.locator("#target-dest-a .target-spread-item")).toHaveText([
            "Spread One",
            "Spread Two"
        ])
        await expect(page.locator("#target-spread-source .target-spread-item")).toHaveCount(0)

        await page.locator("#target-spread-reset").click()
        await expect(page.locator("#target-spread-source .target-spread-item")).toHaveText([
            "Spread One",
            "Spread Two"
        ])
    })
})
