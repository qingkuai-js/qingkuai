import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let count = 0

            const increase = () => {
                count++
            }

            const decrease = () => {
                count--
            }
        </lang-js>

        <section data-page="counter">
            <h1 id="counter-title">Counter</h1>
            <p id="counter-value">{count}</p>
            <div>
                <button
                    id="decrement"
                    @click={decrease}
                >
                    Decrease
                </button>
                <button
                    id="increment"
                    @click={increase}
                >
                    Increase
                </button>
            </div>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test.describe("counter case", () => {
        test("renders counter page", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await expect(page).toHaveTitle("counter")
            await expect(page.locator("#counter-title")).toHaveText("Counter")
            await expect(page.locator("#counter-value")).toHaveText("0")
            await expect(page.locator("#decrement")).toHaveText("Decrease")
            await expect(page.locator("#increment")).toHaveText("Increase")
        })

        test("updates counter value after each click", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await expect(page.locator("#counter-value")).toHaveText("0")

            await page.locator("#increment").click()
            await expect(page.locator("#counter-value")).toHaveText("1")

            await page.locator("#increment").click()
            await expect(page.locator("#counter-value")).toHaveText("2")

            await page.locator("#decrement").click()
            await expect(page.locator("#counter-value")).toHaveText("1")
        })

        test("supports decrement-first and negative values", async ({ page, visitScenario }) => {
            await visitScenario(scenario)

            await page.locator("#decrement").click()
            await expect(page.locator("#counter-value")).toHaveText("-1")

            await page.locator("#increment").click()
            await expect(page.locator("#counter-value")).toHaveText("0")
        })
    })
})
