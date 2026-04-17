import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            const createPendingPromise = () => new Promise(() => {})

            let eventPromise = createPendingPromise()
            let clickCount = 0

            const resetEventPromise = () => {
                eventPromise = createPendingPromise()
                clickCount = 0
            }

            const resolveEventPromise = () => {
                eventPromise = new Promise(resolve => {
                    setTimeout(() => resolve("data loaded"), 10)
                })
            }

            const incrementClick = () => {
                clickCount++
            }
        </lang-js>

        <section data-page="await-directive-event-handling">
            <div>
                <button id="reset-event" @click={resetEventPromise}>Reset</button>
                <button id="resolve-event" @click={resolveEventPromise}>Resolve</button>
            </div>

            <div id="event-container">
                <p id="event-pending" #await={eventPromise}>
                    Loading event data...
                </p>
                <div id="event-resolved" #then={data}>
                    <p id="event-data">{data}</p>
                    <button id="action-btn" @click={incrementClick}>Action</button>
                </div>
                <p id="event-error" #catch={err}>{err}</p>
            </div>

            <p id="click-count">Clicks: {clickCount}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("supports event handling within await then branch", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#event-pending")).toHaveText("Loading event data...")
        await expect(page.locator("#event-resolved")).toHaveCount(0)

        await page.locator("#resolve-event").click()
        await expect(page.locator("#event-resolved")).toHaveCount(1)
        await expect(page.locator("#event-data")).toHaveText("data loaded")

        await page.locator("#action-btn").click()
        await expect(page.locator("#click-count")).toHaveText("Clicks: 1")

        await page.locator("#action-btn").click()
        await page.locator("#action-btn").click()
        await expect(page.locator("#click-count")).toHaveText("Clicks: 3")

        await page.locator("#reset-event").click()
        await expect(page.locator("#event-pending")).toHaveCount(1)
        await expect(page.locator("#event-resolved")).toHaveCount(0)
    })
})
