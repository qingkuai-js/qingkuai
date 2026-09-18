import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let count = reactive(0)

            function getDouble() {
                return count * 2
            }

            const getTitle = () => "n: " + count

            const inc = () => {
                count++
            }
        </lang-js>

        <section data-page="interpolation-tracking-e2e">
            <h1 id="title">Interpolation Tracking</h1>
            <p id="double">{getDouble()}</p>
            <p id="literal">{1 + 2}</p>
            <div id="attr" !title={getTitle()}></div>
            <button id="btn-inc" @click={inc}>Inc count</button>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("reactive reads inside called functions and helpers are tracked at runtime", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)
        await expect(page.locator("#double")).toHaveText("0")
        await expect(page.locator("#literal")).toHaveText("3")
        await expect(page.locator("#attr")).toHaveAttribute("title", "n: 0")

        await page.locator("#btn-inc").click()
        await expect(page.locator("#double")).toHaveText("2")
        await expect(page.locator("#attr")).toHaveAttribute("title", "n: 1")

        await page.locator("#btn-inc").click()
        await expect(page.locator("#double")).toHaveText("4")
        await expect(page.locator("#attr")).toHaveAttribute("title", "n: 2")
    })
})
