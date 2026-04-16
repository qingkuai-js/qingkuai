import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let clickCount = 0
            let inputValue = ""

            const handleClick = () => {
                clickCount++
            }

            const handleInput = event => {
                inputValue = event.target.value
            }
        </lang-js>

        <section data-page="event-binding-basic">
            <button id="click-btn" @click={handleClick}>Click me</button>
            <p id="click-count">{clickCount}</p>

            <input
                id="text-input"
                @input={handleInput(event)}
                placeholder="Type here"
            />
            <p id="input-value">{inputValue}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("fires click handler on each click", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#click-count")).toHaveText("0")

        await page.locator("#click-btn").click()
        await expect(page.locator("#click-count")).toHaveText("1")

        await page.locator("#click-btn").click()
        await page.locator("#click-btn").click()
        await expect(page.locator("#click-count")).toHaveText("3")
    })

    test("fires input handler with event object", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        await expect(page.locator("#input-value")).toHaveText("")

        await page.locator("#text-input").fill("hello")
        await expect(page.locator("#input-value")).toHaveText("hello")

        await page.locator("#text-input").fill("world")
        await expect(page.locator("#input-value")).toHaveText("world")
    })
})
