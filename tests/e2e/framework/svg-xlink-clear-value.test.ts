import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let iconHref = "#shape-a"
            let stateLabel = "normal"

            const setNullHref = () => {
                iconHref = null
                stateLabel = "null"
            }

            const setUndefinedHref = () => {
                iconHref = undefined
                stateLabel = "undefined"
            }
        </lang-js>

        <section data-page="svg-xlink-clear-value">
            <svg id="svg-root" viewBox="0 0 40 40" width="40" height="40">
                <defs>
                    <g id="shape-a"><circle cx="20" cy="20" r="8"></circle></g>
                </defs>

                <use id="icon-use" !xlink:href={iconHref}></use>
            </svg>

            <button id="set-null" @click={setNullHref}>Set null</button>
            <button id="set-undefined" @click={setUndefinedHref}>Set undefined</button>
            <p id="state-label">State: {stateLabel}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("clears xlink href when value becomes null or undefined", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        const hrefInitial = await page
            .locator("#icon-use")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(hrefInitial).toBe("#shape-a")

        await page.locator("#set-null").click()
        await expect(page.locator("#state-label")).toHaveText("State: null")

        const hrefAfterNull = await page
            .locator("#icon-use")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(hrefAfterNull).toBeNull()

        await page.locator("#set-undefined").click()
        await expect(page.locator("#state-label")).toHaveText("State: undefined")

        const hrefAfterUndefined = await page
            .locator("#icon-use")
            .evaluate(node => node.getAttributeNS("http://www.w3.org/1999/xlink", "href"))
        expect(hrefAfterUndefined).toBeNull()
    })
})
