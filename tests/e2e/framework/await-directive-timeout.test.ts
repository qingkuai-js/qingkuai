import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let slowPromise = new Promise(resolve => {
                setTimeout(() => resolve("slow done"), 5000)
            })

            let timeoutReason = ""

            const replaceWithFastPromise = () => {
                slowPromise = new Promise(resolve => {
                    setTimeout(() => resolve("fast done"), 50)
                })
            }

            const replaceWithError = () => {
                slowPromise = new Promise((_, reject) => {
                    setTimeout(() => reject("timeout"), 50)
                })
                timeoutReason = "manual timeout"
            }
        </lang-js>

        <section data-page="await-directive-timeout">
            <div>
                <button id="use-fast" @click={replaceWithFastPromise}>Use Fast Promise</button>
                <button id="trigger-timeout" @click={replaceWithError}>Trigger Timeout</button>
            </div>

            <div id="timeout-container">
                <p id="timeout-pending" #await={slowPromise}>
                    Waiting (may timeout)...
                </p>
                <p id="timeout-resolved" #then={result}>
                    Success: {result}
                </p>
                <p id="timeout-error" #catch={err}>
                    Failed: {err} {timeoutReason}
                </p>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("handles promise cancellation by replacing with new promise", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#timeout-pending")).toHaveText("Waiting (may timeout)...")
        await expect(page.locator("#timeout-resolved")).toHaveCount(0)

        await page.locator("#use-fast").click()
        await expect(page.locator("#timeout-resolved")).toHaveText("Success: fast done")
        await expect(page.locator("#timeout-pending")).toHaveCount(0)
    })

    test("handles promise replacement with rejection", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#timeout-pending")).toHaveText("Waiting (may timeout)...")

        await page.locator("#trigger-timeout").click()
        await expect(page.locator("#timeout-error")).toContainText("Failed: timeout")
        await expect(page.locator("#timeout-pending")).toHaveCount(0)
    })
})
