import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let dom = null
            let visible = true
            let explicitDom = null

            const toggleVisible = () => {
                visible = !visible
            }
        </lang-js>

        <section data-page="attribute-dom-shorthand">
            <button id="toggle-visible" @click={toggleVisible}>Toggle visible</button>

            <qk:spread #if={visible}>
                <div id="explicit-dom" &dom={explicitDom}></div>
                <div id="shorthand-dom" &dom></div>
            </qk:spread>

            <p id="state-explicit">Explicit: {explicitDom ? explicitDom.id : "null"}</p>
            <p id="state-shorthand">Shorthand: {dom ? dom.id : "null"}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("treats &dom shorthand and explicit syntax equivalently", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#state-explicit")).toHaveText("Explicit: explicit-dom")
        await expect(page.locator("#state-shorthand")).toHaveText("Shorthand: shorthand-dom")

        await page.locator("#toggle-visible").click()

        await expect(page.locator("#explicit-dom")).toHaveCount(0)
        await expect(page.locator("#shorthand-dom")).toHaveCount(0)
        await expect(page.locator("#state-explicit")).toHaveText("Explicit: null")
        await expect(page.locator("#state-shorthand")).toHaveText("Shorthand: null")

        await page.locator("#toggle-visible").click()

        await expect(page.locator("#state-explicit")).toHaveText("Explicit: explicit-dom")
        await expect(page.locator("#state-shorthand")).toHaveText("Shorthand: shorthand-dom")
    })
})
