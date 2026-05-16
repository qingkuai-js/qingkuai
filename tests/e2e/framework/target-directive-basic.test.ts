import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let targetSelector = null
            let teleportLabel = "Initial content"
            let destA
            let destB

            const teleportToA = () => {
                targetSelector = "#target-dest-a"
            }

            const teleportToB = () => {
                targetSelector = "#target-dest-b"
            }

            const resetInline = () => {
                targetSelector = null
            }
        </lang-js>

        <section data-page="target-directive-basic">
            <h1 id="target-title">Target directive</h1>

            <div>
                <button
                    id="target-to-a"
                    @click={teleportToA}
                >
                    Teleport to A
                </button>
                <button
                    id="target-to-b"
                    @click={teleportToB}
                >
                    Teleport to B
                </button>
                <button
                    id="target-reset"
                    @click={resetInline}
                >
                    Reset inline
                </button>
            </div>

            <div id="target-source-container">
                <div #target={targetSelector}>
                    <p id="target-content">{teleportLabel}</p>
                </div>
            </div>

            <div
                id="target-dest-a"
                &handle={destA}
            ></div>
            <div
                id="target-dest-b"
                &handle={destB}
            ></div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("renders content inline when target is null", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page).toHaveTitle("target-directive-basic")
        await expect(page.locator("#target-title")).toHaveText("Target directive")
        await expect(page.locator("#target-source-container #target-content")).toBeVisible()
        await expect(page.locator("#target-content")).toHaveText("Initial content")
        await expect(page.locator("#target-dest-a #target-content")).toHaveCount(0)
        await expect(page.locator("#target-dest-b #target-content")).toHaveCount(0)
    })

    test("works with destination nodes that also bind &handle", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#target-source-container #target-content")).toHaveText(
            "Initial content"
        )

        await page.locator("#target-to-a").click()
        await expect(page.locator("#target-dest-a #target-content")).toHaveText("Initial content")
        await expect(page.locator("#target-source-container #target-content")).toHaveCount(0)

        await page.locator("#target-to-b").click()
        await expect(page.locator("#target-dest-b #target-content")).toHaveText("Initial content")
        await expect(page.locator("#target-dest-a #target-content")).toHaveCount(0)

        await page.locator("#target-reset").click()
        await expect(page.locator("#target-source-container #target-content")).toHaveText(
            "Initial content"
        )
    })
})
