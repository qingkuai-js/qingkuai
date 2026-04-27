import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let iconHref = "#shape-a"
            let stateLabel = "normal"

            const setFalseHref = () => {
                iconHref = false
                stateLabel = "false"
            }

            const resetHref = () => {
                iconHref = "#shape-a"
                stateLabel = "reset"
            }
        </lang-js>

        <section data-page="svg-xlink-false-remove">
            <svg id="svg-root" viewBox="0 0 40 40" width="40" height="40">
                <defs>
                    <g id="shape-a"><circle cx="20" cy="20" r="8"></circle></g>
                </defs>

                <use id="icon-use" !xlink:href={iconHref}></use>
            </svg>

            <button id="set-false" @click={setFalseHref}>Set false</button>
            <button id="reset-href" @click={resetHref}>Reset</button>
            <p id="state-label">State: {stateLabel}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("clears xlink href when value becomes false", async ({ page, visitScenario }) => {
        await visitScenario(scenario)

        const hrefInitial = await page
            .locator("#icon-use")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(hrefInitial).toBe("#shape-a")

        await page.locator("#set-false").click()
        await expect(page.locator("#state-label")).toHaveText("State: false")

        const hrefAfterFalse = await page
            .locator("#icon-use")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(hrefAfterFalse).toBeNull()

        await page.locator("#reset-href").click()
        await expect(page.locator("#state-label")).toHaveText("State: reset")

        const hrefAfterReset = await page
            .locator("#icon-use")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(hrefAfterReset).toBe("#shape-a")
    })
})
