import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})

            let delayedTarget = null
            let delayedTargetPromise = createPendingPromise()

            const resolveDelayedTarget = () => {
                delayedTargetPromise = new Promise(resolve => {
                    setTimeout(() => resolve("Delayed destination ready"), 10)
                })
            }

            const resetDelayedTarget = () => {
                delayedTargetPromise = createPendingPromise()
                delayedTarget = null
            }

            const teleportToDelayedTarget = () => {
                delayedTarget = "#target-delayed-dest"
            }
        </lang-js>

        <section data-page="target-directive-delayed">
            <h1 id="target-title">Target directive</h1>

            <div>
                <button
                    id="target-delayed-resolve"
                    @click={resolveDelayedTarget}
                >
                    Resolve delayed dest
                </button>
                <button
                    id="target-delayed-teleport"
                    @click={teleportToDelayedTarget}
                >
                    Teleport delayed
                </button>
                <button
                    id="target-delayed-reset"
                    @click={resetDelayedTarget}
                >
                    Reset delayed
                </button>
            </div>
            <div id="target-delayed-source">
                <p
                    id="target-delayed-content"
                    #target={delayedTarget}
                >
                    Delayed payload
                </p>
            </div>
            <div id="target-delayed-await-host">
                <p
                    id="target-delayed-await-pending"
                    #await={delayedTargetPromise}
                >
                    Waiting delayed destination
                </p>
                <div #then={msg}>
                    <div id="target-delayed-dest">{msg}</div>
                </div>
                <p
                    id="target-delayed-await-catch"
                    #catch={err}
                >
                    {err}
                </p>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("teleports to a delayed node rendered by await", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#target-delayed-await-pending")).toHaveText(
            "Waiting delayed destination"
        )
        await expect(page.locator("#target-delayed-dest")).toHaveCount(0)

        await page.locator("#target-delayed-resolve").click()
        await expect(page.locator("#target-delayed-dest")).toHaveText("Delayed destination ready")

        await page.locator("#target-delayed-teleport").click()
        await expect(page.locator("#target-delayed-dest #target-delayed-content")).toHaveText(
            "Delayed payload"
        )
        await expect(page.locator("#target-delayed-source #target-delayed-content")).toHaveCount(0)

        await page.locator("#target-delayed-reset").click()
        await expect(page.locator("#target-delayed-source #target-delayed-content")).toHaveText(
            "Delayed payload"
        )
        await expect(page.locator("#target-delayed-dest #target-delayed-content")).toHaveCount(0)
    })
})
