import type { E2EScenarioInput } from "#type-declarations/testing"

import { defineE2ETestFile } from "../scenario-module"

const scenario: E2EScenarioInput = {
    input: `
        <lang-js>
            let handle = null
            let visible = true
            let explicitHandle = null

            const toggleVisible = () => {
                visible = !visible
            }
        </lang-js>

        <section data-page="attribute-handle-shorthand">
            <button id="toggle-visible" @click={toggleVisible}>Toggle visible</button>

            <qk:spread #if={visible}>
                <div id="explicit-handle" &handle={explicitHandle}></div>
                <div id="shorthand-handle" &handle></div>
            </qk:spread>

            <p id="state-explicit">Explicit: {explicitHandle ? explicitHandle.id : "null"}</p>
            <p id="state-shorthand">Shorthand: {handle ? handle.id : "null"}</p>
        </section>
    `
}

export default await defineE2ETestFile(import.meta.url, scenario, ({ test, expect }) => {
    test("treats &handle shorthand and explicit syntax equivalently", async ({
        page,
        visitScenario
    }) => {
        await visitScenario(scenario)

        await expect(page.locator("#state-explicit")).toHaveText("Explicit: explicit-handle")
        await expect(page.locator("#state-shorthand")).toHaveText("Shorthand: shorthand-handle")

        await page.locator("#toggle-visible").click()

        await expect(page.locator("#explicit-handle")).toHaveCount(0)
        await expect(page.locator("#shorthand-handle")).toHaveCount(0)
        await expect(page.locator("#state-explicit")).toHaveText("Explicit: null")
        await expect(page.locator("#state-shorthand")).toHaveText("Shorthand: null")

        await page.locator("#toggle-visible").click()

        await expect(page.locator("#state-explicit")).toHaveText("Explicit: explicit-handle")
        await expect(page.locator("#state-shorthand")).toHaveText("Shorthand: shorthand-handle")
    })
})
